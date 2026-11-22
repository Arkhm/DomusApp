import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { StatusBanner } from '../components/StatusBanner';
import { forgotPassword } from '../services/authService';
import { toApiFailure } from '../services/api';
import { colors, spacing, typography } from '../theme';
import type { RootStackScreenProps } from '../types';

export function ForgotPasswordScreen({ route, navigation }: RootStackScreenProps<'ForgotPassword'>) {
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    if (loading) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Informe um e-mail válido.'); return;
    }
    setError(null); setLoading(true);
    try { await forgotPassword(email.trim().toLowerCase()); setSubmitted(true); }
    catch (failure) { setError(toApiFailure(failure, 'Não foi possível solicitar a recuperação.').message); }
    finally { setLoading(false); }
  }
  return <SafeAreaView style={styles.safe} edges={['bottom']}>
    <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{submitted ? 'Confira seu e-mail' : 'Recuperar senha'}</Text>
        {submitted ? <>
          <StatusBanner tone="info" title="Solicitação recebida" message="Se o e-mail estiver cadastrado, você receberá um link válido por uma hora. Abra-o no navegador, defina a nova senha e volte ao aplicativo para entrar." />
          <Button label="Voltar ao login" onPress={() => navigation.goBack()} />
        </> : <>
          <Text>Informe o e-mail cadastrado pela administração do condomínio.</Text>
          {error && <StatusBanner tone="error" title="Não foi possível continuar" message={error} />}
          <Input label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" editable={!loading} />
          <Button label="Enviar link de recuperação" isLoading={loading} onPress={() => void submit()} />
        </>}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.xl },
  title: { ...typography.subtitle, color: colors.textPrimary },
});
