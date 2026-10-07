import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { colors, elevation, layout, radius, spacing, typography } from '../theme';

interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  /** Linha de apoio — ex.: identifica a conta afetada pela ação. */
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /**
   * Esconde o botão de cancelar, deixando só a ação de confirmar. Para avisos,
   * em que o único caminho é dar ciência — não há o que cancelar.
   */
  hideCancel?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmação modal para ações que não devem disparar em um toque só.
 *
 * Usa `Modal` e não `Alert`: no target web o `Alert` do react-native-web é um
 * método vazio, então a confirmação simplesmente não apareceria.
 */
export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  hideCancel = false,
  onConfirm,
  onCancel,
}: ConfirmSheetProps): React.JSX.Element {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // Botão físico "voltar" do Android fecha sem executar a ação.
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
        />

        <View
          style={[styles.card, elevation.raised]}
          accessibilityViewIsModal
          accessibilityRole="alert"
        >
          <View style={styles.texts}>
            <Text style={styles.title}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
          </View>

          <View style={styles.actions}>
            <Button label={confirmLabel} onPress={onConfirm} />
            {hideCancel ? null : (
              <Button label={cancelLabel} variant="ghost" onPress={onCancel} />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.screenPadding,
  },
  card: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    gap: spacing.xl,
  },
  texts: {
    gap: spacing.xs,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
  },
  actions: {
    gap: spacing.sm,
  },
});
