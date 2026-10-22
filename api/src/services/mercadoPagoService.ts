import fetch from 'node-fetch';

const MERCADO_PAGO_BASE_URL = 'https://api.mercadopago.com';

function getAccessToken(): string {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) {
    throw new Error('MERCADO_PAGO_ACCESS_TOKEN não está definido no arquivo .env');
  }
  return token;
}

function isSandbox(): boolean {
  // Configuração explícita via env (recomendado)
  const explicitSandbox = process.env.MERCADO_PAGO_SANDBOX;
  if (explicitSandbox !== undefined) {
    return explicitSandbox === 'true';
  }
  
  // Fallback: detecta por URL base (sandbox usa api.mercadopago.com mas pode ter config diferente)
  const baseUrl = process.env.MERCADO_PAGO_BASE_URL || '';
  if (baseUrl.includes('sandbox')) {
    return true;
  }
  
  // Fallback legado: tokens de teste APP_USR- (apenas se não configurado explicitamente)
  // NOTA: Em produção também usa APP_USR-, por isso só usa como último recurso
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN || '';
  return token.startsWith('APP_USR-') && process.env.NODE_ENV !== 'production';
}

function generateIdempotencyKey(externalReference: string): string {
  return `${externalReference}-${Date.now()}`;
}

function buildSandboxPixPayload(externalReference: string): any {
  // SANDBOX EXIGE VALORES FIXOS para PIX funcionar (conforme doc oficial)
  // total_amount: "50.00", payer.email: "test@testuser.com", payer.first_name: "APRO"
  return {
    type: 'online',
    processing_mode: 'automatic',
    external_reference: externalReference,
    total_amount: '50.00',
    payer: {
      email: 'test@testuser.com',
      first_name: 'APRO',
      last_name: 'Test',
    },
    transactions: {
      payments: [
        {
          amount: '50.00',
          payment_method: {
            id: 'pix',
            type: 'bank_transfer',
          },
        },
      ],
    },
  };
}

interface PayerInfo {
  email: string;
  first_name: string;
  last_name: string;
  identification?: {
    type: string;
    number: string;
  };
  phone?: {
    area_code: string;
    number: string;
  };
  address?: {
    zip_code: string;
    street_name: string;
    street_number: string;
  };
}

interface OrderItem {
  title: string;
  description: string;
  quantity: number;
  unit_price: string;
}

interface CreateOrderRequest {
  type: 'online';
  processing_mode: 'automatic';
  total_amount: string;
  external_reference: string;
  transactions: {
    payments: Array<{
      amount: string;
      payment_method: {
        id: string;
        type: string;
      };
    }>;
  };
  payer: PayerInfo;
}

interface MercadoPagoOrderResponse {
  id: string;
  status: string;
  status_detail: string;
  processing_mode: string;
  total_amount: string;
  external_reference: string;
  items: OrderItem[];
  payer: PayerInfo;
  payments: Array<{
    id: string;
    status: string;
    status_detail: string;
    transaction_amount: number;
    currency_id: string;
    payment_method_id: string;
    payment_type_id: string;
    date_created: string;
    date_approved?: string;
    point_of_interaction?: {
      transaction_data?: {
        qr_code?: string;
        qr_code_base64?: string;
      };
    };
    transaction_details?: {
      external_resource_url?: string;
    };
  }>;
  transactions?: {
    payments: Array<{
      id: string;
      status: string;
      status_detail: string;
      amount: string;
      date_of_expiration?: string;
      reference_id?: string;
      payment_method: {
        id: string;
        type: string;
        ticket_url?: string;
        qr_code?: string;
        qr_code_base64?: string;
      };
    }>;
  };
  qr_code?: string;
  qr_code_base64?: string;
  boleto_url?: string;
  preference_id?: string;
  date_created: string;
  date_last_updated: string;
}

interface PaymentInfo {
  id: string;
  status: string;
  status_detail: string;
  transaction_amount: number;
  currency_id: string;
  payment_method_id: string;
  payment_type_id: string;
  date_created: string;
  date_approved?: string;
  payer: PayerInfo;
}

export const mercadoPagoService = {
  async createOrder(data: {
    externalReference: string;
    description: string;
    amount: number;
    payer: {
      name: string;
      email: string;
      identification?: { type: string; number: string };
      phone?: { area_code: string; number: string };
    };
    items: OrderItem[];
    backUrls?: { success: string; failure: string; pending: string };
    notificationUrl?: string;
    expirationDays?: number;
  }): Promise<MercadoPagoOrderResponse> {
    const amountStr = data.amount.toFixed(2);
    const isTest = isSandbox();
    const idempotencyKey = generateIdempotencyKey(data.externalReference);

    let requestBody: any;

    if (isTest) {
      // SANDBOX: Usa payload fixo conforme documentação oficial do MP para PIX
      requestBody = buildSandboxPixPayload(data.externalReference);
    } else {
      // PRODUÇÃO: Usa dados reais do pagador
      const [firstName, ...lastNameParts] = data.payer.name.trim().split(' ');
      const lastName = lastNameParts.join(' ') || firstName;

      const payer: PayerInfo = {
        email: data.payer.email,
        first_name: firstName,
        last_name: lastName,
      };

      if (data.payer.identification) {
        payer.identification = data.payer.identification;
      }

      if (data.payer.phone) {
        payer.phone = data.payer.phone;
      }

      requestBody = {
        type: 'online',
        processing_mode: 'automatic',
        total_amount: amountStr,
        external_reference: data.externalReference,
        transactions: {
          payments: [
            {
              amount: amountStr,
              payment_method: {
                id: 'pix',
                type: 'bank_transfer',
              },
            },
          ],
        },
        payer,
      };
    }

    const response = await fetch(`${MERCADO_PAGO_BASE_URL}/v1/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAccessToken()}`,
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Erro ao criar order no Mercado Pago: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    return await response.json() as MercadoPagoOrderResponse;
  },

  async getOrder(orderId: string): Promise<MercadoPagoOrderResponse> {
    const response = await fetch(`${MERCADO_PAGO_BASE_URL}/v1/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Erro ao buscar order no Mercado Pago: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    return await response.json() as MercadoPagoOrderResponse;
  },

  async getPayment(paymentId: string): Promise<PaymentInfo> {
    const response = await fetch(`${MERCADO_PAGO_BASE_URL}/v1/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Erro ao buscar pagamento no Mercado Pago: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    return await response.json() as PaymentInfo;
  },

  mapPaymentStatus(mpStatus: string, mpStatusDetail?: string): string {
    // Se status é 'processed' e detail é 'accredited', considera como pago
    if (mpStatus === 'processed' && mpStatusDetail === 'accredited') {
      return 'PAID';
    }
    // Se status é 'approved' ou 'accredited', considera como pago
    if (mpStatus === 'approved' || mpStatus === 'accredited') {
      return 'PAID';
    }
    switch (mpStatus) {
      case 'pending':
      case 'waiting_payment':
      case 'processed':
        return 'PENDING';
      case 'rejected':
        return 'REJECTED';
      case 'cancelled':
      case 'cancelled_by_user':
        return 'CANCELLED';
      case 'expired':
        return 'EXPIRED';
      case 'in_process':
        return 'PENDING';
      case 'authorized':
        return 'PENDING';
      case 'in_mediation':
        return 'PENDING';
      case 'refunded':
        return 'REFUNDED';
      case 'charged_back':
        return 'CHARGED_BACK';
      default:
        return 'PENDING';
    }
  },

  extractPaymentData(order: MercadoPagoOrderResponse): {
    paymentId: string | null;
    qrCode: string | null;
    qrCodeBase64: string | null;
    boletoUrl: string | null;
    status: string;
    statusDetail: string;
  } {
    const payment = order.payments?.[0];
    const txPayment = order.transactions?.payments?.[0];
    const txPaymentMethod = txPayment?.payment_method;

    return {
      paymentId: payment?.id?.toString() || txPayment?.id?.toString() || null,
      qrCode: order.qr_code || txPaymentMethod?.qr_code || payment?.point_of_interaction?.transaction_data?.qr_code || null,
      qrCodeBase64: order.qr_code_base64 || txPaymentMethod?.qr_code_base64 || payment?.point_of_interaction?.transaction_data?.qr_code_base64 || null,
      boletoUrl: order.boleto_url || txPaymentMethod?.ticket_url || payment?.transaction_details?.external_resource_url || null,
      status: payment?.status || txPayment?.status || order.status,
      statusDetail: payment?.status_detail || txPayment?.status_detail || order.status_detail,
    };
  },
};