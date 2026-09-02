import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ConfirmSheet, Input, StatusBanner } from '../components';
import { useAuth } from '../contexts/AuthContext';
import { colors, elevation, layout, radius, spacing, typography } from '../theme';
import type { ApiFailure } from '../services/api';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  email: string | null;
  password: string | null;
}

const NO_FIELD_ERRORS: FieldErrors = { email: null, password: null };

function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Informe seu e-mail.';
  if (!EMAIL_PATTERN.test(email.trim())) return 'E-mail em formato inválido.';
  return null;
}

function validatePassword(password: string): string | null {
  if (!password) return 'Informe sua senha.';
  if (password.length < 6) return 'A senha tem no mínimo 6 caracteres.';
  return null;
}

export function LoginScreen(): React.JSX.Element {
  const { signIn, isAuthenticating } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(NO_FIELD_ERRORS);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [isPasswordHelpVisible, setIsPasswordHelpVisible] = useState(false);

  async function handleSubmit(): Promise<void> {
    const errors: FieldErrors = {
      email: validateEmail(email),
      password: validatePassword(password),
    };

    setFieldErrors(errors);
    setFailure(null);

    if (errors.email || errors.password) return;

    const result = await signIn(email.trim().toLowerCase(), password);
    if (result) setFailure(result);
    // Sucesso não navega manualmente: o AppNavigator troca de stack sozinho
    // assim que o usuário autenticado aparece no contexto.
  }

  function bannerTitle(kind: ApiFailure['kind']): string {
    if (kind === 'network') return 'Servidor indisponível';
    if (kind === 'credentials') return 'Não foi possível entrar';
    return 'Algo deu errado';
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <View style={styles.brandMark}>
              <Image
                source={require('../../assets/domus-logo.png')}
                style={styles.brandLogo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brandName}>DomusApp</Text>
            <Text style={styles.brandTagline}>
              A gestão do seu condomínio, na palma da mão.
            </Text>
          </View>

          <View style={[styles.card, elevation.raised]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Entrar</Text>
              <Text style={styles.cardSubtitle}>
                Use o e-mail cadastrado pela administração do condomínio.
              </Text>
            </View>

            {failure ? (
              <StatusBanner
                tone={failure.kind === 'network' ? 'warning' : 'error'}
                title={bannerTitle(failure.kind)}
                message={failure.message}
              />
            ) : null}

            <View style={styles.form}>
              <Input
                label="E-mail"
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => ({ ...prev, email: null }));
                  }
                }}
                placeholder="exemplo@email.com"
                error={fieldErrors.email}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                editable={!isAuthenticating}
              />

              <Input
                label="Senha"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  if (fieldErrors.password) {
                    setFieldErrors((prev) => ({ ...prev, password: null }));
                  }
                }}
                placeholder="Sua senha"
                error={fieldErrors.password}
                isPassword
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => void handleSubmit()}
                editable={!isAuthenticating}
              />
            </View>

            <Button
              label="Entrar"
              onPress={() => void handleSubmit()}
              isLoading={isAuthenticating}
              accessibilityHint="Autentica com o e-mail e a senha informados"
            />

            <Pressable
              onPress={() => setIsPasswordHelpVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Esqueci minha senha"
              style={styles.forgotLink}
            >
              <Text style={styles.forgotLabel}>Esqueci minha senha</Text>
            </Pressable>
          </View>

          <Text style={styles.footNote}>
            O acesso do morador é criado pela administração no painel web. Não há autocadastro.
          </Text>
        </ScrollView>

        <ConfirmSheet
          visible={isPasswordHelpVisible}
          title="Esqueci minha senha"
          message="Contate a administração local do condomínio para renovar a sua senha. A redefinição é sempre feita por lá."
          confirmLabel="Entendi"
          hideCancel
          onConfirm={() => setIsPasswordHelpVisible(false)}
          onCancel={() => setIsPasswordHelpVisible(false)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.brand,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.xxxl,
    justifyContent: 'center',
    gap: spacing.xxl,
  },
  brand: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xxl,
  },
  brandMark: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  brandLogo: {
    // 37 e nao 34: o asset tem folga assimetrica embutida para centrar a marca
    // opticamente, entao a arte ocupa 89% do arquivo em vez dos 97% de antes.
    width: 37,
    height: 37,
  },
  brandName: {
    ...typography.display,
    color: colors.textOnBrand,
  },
  brandTagline: {
    ...typography.body,
    color: colors.textOnBrandMuted,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    gap: spacing.xl,
  },
  cardHeader: {
    gap: spacing.xs,
  },
  cardTitle: {
    ...typography.title,
    color: colors.textPrimary,
  },
  cardSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  form: {
    gap: spacing.lg,
  },
  forgotLink: {
    minHeight: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forgotLabel: {
    ...typography.label,
    color: colors.brand,
    textDecorationLine: 'underline',
  },
  footNote: {
    ...typography.caption,
    color: colors.textOnBrandMuted,
    textAlign: 'center',
  },
});
