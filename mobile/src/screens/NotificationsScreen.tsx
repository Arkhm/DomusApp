import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBanner } from '../components';
import type { NotificationsInbox } from '../hooks/useNotifications';
import type { AppNotification } from '../services/notificationService';
import type { RootStackParamList } from '../types';
import { colors, layout, radius, spacing, typography } from '../theme';

const formatDate = (value: string) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

export function NotificationsScreen({ inbox }: { inbox: NotificationsInbox }) {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(true);
  const [filterWidth, setFilterWidth] = useState(0);
  const selection = useRef(new Animated.Value(0)).current;
  const listEntrance = useRef(new Animated.Value(1)).current;
  const listRef = useRef<FlatList<AppNotification>>(null);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value);
    }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
      selection.stopAnimation();
      listEntrance.stopAnimation();
    };
  }, [selection, listEntrance]);
  useEffect(() => {
    if (reduceMotion) {
      selection.stopAnimation();
      listEntrance.stopAnimation();
      selection.setValue(onlyUnread ? 1 : 0);
      listEntrance.setValue(1);
    }
  }, [reduceMotion, onlyUnread, selection, listEntrance]);

  function selectFilter(value: boolean) {
    if (value === onlyUnread) return;
    selection.stopAnimation();
    listEntrance.stopAnimation();
    setOnlyUnread(value);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    if (reduceMotion) return;
    listEntrance.setValue(0);
    Animated.parallel([
      Animated.timing(selection, { toValue: value ? 1 : 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(listEntrance, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }
  const { items, loading, refreshing, failure, openingId, unread, reload, markRead } = inbox;
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));
  const visible = onlyUnread ? items.filter((item) => !item.isRead) : items;

  async function open(item: AppNotification) {
    if (!await markRead(item)) return;
    if (item.type === 'NOTICE') navigation.navigate('Comunicado', { notice: item.notice });
    else navigation.navigate('Evento', { event: item.event });
  }

  return <SafeAreaView style={styles.screen} edges={['top']}>
    <View style={styles.hero}>
      <View style={styles.row}><Text style={styles.overline}>SEU CONDOMÍNIO, MAIS PERTO</Text><View style={styles.bell}><Ionicons name="notifications-outline" size={spacing.xxl} color={colors.accent} /></View></View>
      <Text accessibilityRole="header" style={styles.title}>Notificações</Text>
      <Text style={styles.caption}>As novidades importantes chegam por aqui.</Text>
      <View style={styles.count}><View style={styles.dot} /><Text style={styles.countText}>{loading ? 'Carregando…' : unread ? `${unread} ${unread === 1 ? 'não lida' : 'não lidas'}` : 'Tudo em dia'}</Text></View>
    </View>
    <View style={styles.body}>
      <View style={styles.filters}>
        <View style={styles.filterTrack} onLayout={({ nativeEvent }) => setFilterWidth(nativeEvent.layout.width)}>
          <Animated.View pointerEvents="none" style={[styles.filterIndicator, { width: Math.max(0, (filterWidth - spacing.sm) / 2), transform: [{ translateX: selection.interpolate({ inputRange: [0, 1], outputRange: [0, (filterWidth + spacing.sm) / 2] }) }] }]} />
          {[false, true].map((value) => <Pressable key={String(value)} accessibilityRole="button" accessibilityState={{ selected: value === onlyUnread }} onPress={() => selectFilter(value)} style={styles.filter}><Animated.Text style={[styles.filterText, { color: selection.interpolate({ inputRange: [0, 1], outputRange: value ? [colors.textSecondary, colors.textOnBrand] : [colors.textOnBrand, colors.textSecondary] }) }]}>{value ? 'Não lidas' : 'Todas'}</Animated.Text></Pressable>)}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Atualizar notificações" disabled={refreshing} onPress={() => void reload()} style={styles.refresh}><Ionicons name="refresh-outline" size={spacing.xl} color={colors.brand} /></Pressable>
      </View>
      {failure && <StatusBanner tone="error" title="Não foi possível atualizar" message={failure.message} actionLabel="Tentar novamente" onAction={() => void reload()} />}
      <Animated.View style={[styles.listViewport, { opacity: listEntrance.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }), transform: [{ translateX: listEntrance.interpolate({ inputRange: [0, 1], outputRange: [onlyUnread ? 12 : -12, 0] }) }] }]}>
      <FlatList ref={listRef} data={visible} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing && !loading} onRefresh={() => void reload()} tintColor={colors.brand} />} showsVerticalScrollIndicator={false}
        ListEmptyComponent={loading ? <ActivityIndicator accessibilityLabel="Carregando notificações" color={colors.brand} style={styles.empty} /> : !failure ? <View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name={onlyUnread ? 'checkmark-done-outline' : 'notifications-off-outline'} size={spacing.xxxl} color={colors.brand} /></View><Text style={styles.emptyTitle}>{onlyUnread ? 'Você está em dia' : 'Nenhuma novidade por enquanto'}</Text><Text style={styles.emptyCaption}>{onlyUnread ? 'Todas as notificações foram lidas.' : 'Novos comunicados e eventos do seu condomínio aparecerão aqui.'}</Text></View> : null}
        renderItem={({ item }) => {
          const urgent = item.type === 'NOTICE' && item.notice.priority === 'URGENT';
          return <Pressable accessibilityRole="button" accessibilityLabel={`${item.description}: ${item.title}. ${item.isRead ? 'Lida' : 'Não lida'}. Abrir`} accessibilityState={{ busy: openingId === item.id, disabled: openingId !== null }} disabled={openingId !== null} onPress={() => void open(item)} style={({ pressed }) => [styles.card, !item.isRead && styles.unreadCard, pressed && styles.pressed]}>
            <View style={[styles.icon, urgent && styles.urgentIcon]}><Ionicons name={item.type === 'NOTICE' ? 'megaphone-outline' : 'calendar-outline'} size={spacing.xxl} color={urgent ? colors.danger : colors.brand} /></View>
            <View style={styles.copy}><View style={styles.row}><Text style={[styles.kind, urgent && styles.urgentText]}>{urgent ? 'Comunicado urgente' : item.description}</Text>{!item.isRead && <View style={styles.dot} />}</View><Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text><Text style={styles.date}>{formatDate(item.createdAt)}</Text></View>
            {openingId === item.id ? <ActivityIndicator color={colors.brand} /> : <Ionicons name="chevron-forward" size={spacing.lg} color={colors.textSecondary} />}
          </Pressable>;
        }} />
      </Animated.View>
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.brand },
  hero: { padding: layout.screenPadding, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  overline: { ...typography.overline, flex: 1, color: colors.textOnBrandMuted },
  bell: { padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.brandSoft },
  title: { ...typography.display, color: colors.textOnBrand },
  caption: { ...typography.body, color: colors.textOnBrandMuted },
  count: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.brandSoft, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, marginTop: spacing.sm },
  countText: { ...typography.label, color: colors.accent },
  dot: { width: spacing.sm, height: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.accent },
  body: { flex: 1, backgroundColor: colors.background, paddingHorizontal: layout.screenPadding, paddingTop: spacing.xl, gap: spacing.md },
  filters: { flexDirection: 'row', gap: spacing.sm },
  listViewport: { flex: 1 },
  filterTrack: { flex: 1, flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.pill },
  filterIndicator: { position: 'absolute', top: 0, bottom: 0, borderRadius: radius.pill, backgroundColor: colors.brand },
  filter: { flex: 1, minHeight: layout.minTouchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  filterText: { ...typography.label, color: colors.textSecondary },
  refresh: { width: layout.minTouchTarget, minHeight: layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  list: { gap: spacing.md, paddingBottom: spacing.xxl },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg },
  unreadCard: { borderLeftColor: colors.accent, borderLeftWidth: spacing.xs },
  pressed: { opacity: 0.8 },
  icon: { padding: spacing.md, backgroundColor: colors.accentSoft, borderRadius: radius.md, alignSelf: 'flex-start' },
  urgentIcon: { backgroundColor: colors.dangerSoft },
  urgentText: { ...typography.label, color: colors.danger },
  copy: { flex: 1, gap: spacing.sm },
  kind: { ...typography.labelSmall, flex: 1, color: colors.textSecondary },
  cardTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  date: { ...typography.caption, color: colors.textSecondary },
  empty: { alignItems: 'center', paddingVertical: spacing.huge, gap: spacing.md },
  emptyIcon: { padding: spacing.xl, borderRadius: radius.pill, backgroundColor: colors.accentSoft },
  emptyTitle: { ...typography.subtitle, textAlign: 'center', color: colors.textPrimary },
  emptyCaption: { ...typography.body, textAlign: 'center', color: colors.textSecondary },
});
