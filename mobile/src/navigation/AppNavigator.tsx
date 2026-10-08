import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Easing, StyleSheet, View } from 'react-native';
import { NavigationContainer, type Theme } from '@react-navigation/native';
import { CardStyleInterpolators, createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LoginScreen } from '../screens/LoginScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { NoticesScreen, NoticeDetailScreen } from '../screens/NoticesScreen';
import { ComingSoonScreen, TabPlaceholder } from '../screens/ComingSoonScreen';
import { useAuth } from '../contexts/AuthContext';
import { colors, fontFamily, layout, spacing, typography } from '../theme';
import type { MainTabParamList, RootStackParamList } from '../types';

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const navigationTheme: Theme = {
  dark: false,
  colors: {
    primary: colors.brand,
    background: colors.background,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.accent,
  },
  fonts: {
    regular: { fontFamily: fontFamily.regular, fontWeight: '400' },
    medium: { fontFamily: fontFamily.medium, fontWeight: '500' },
    bold: { fontFamily: fontFamily.semibold, fontWeight: '600' },
    heavy: { fontFamily: fontFamily.bold, fontWeight: '700' },
  },
};

function ReservationsScreen(): React.JSX.Element {
  return (
    <TabPlaceholder
      title="Reservas"
      description="A API ainda não expõe /reservations nem um modelo de área comum. A aba fica reservada para a próxima entrega."
    />
  );
}

function AccessScreen(): React.JSX.Element {
  return (
    <TabPlaceholder
      title="Acessos"
      description="Controle de portaria e liberação de visitantes ainda não existe na API."
    />
  );
}

function NotificationsScreen(): React.JSX.Element {
  return (
    <TabPlaceholder
      title="Notificações"
      description="Em breve, você poderá acompanhar aqui as novidades e os alertas do seu condomínio."
    />
  );
}

const TAB_ICONS: Record<keyof MainTabParamList, [active: string, inactive: string]> = {
  Inicio: ['home', 'home-outline'],
  Reservas: ['calendar', 'calendar-outline'],
  Acessos: ['key', 'key-outline'],
  Notificacoes: ['notifications', 'notifications-outline'],
  Perfil: ['person', 'person-outline'],
};

function MainTabs(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIcon: ({ color, size, focused }) => {
          const [active, inactive] = TAB_ICONS[route.name];
          const name = (focused ? active : inactive) as React.ComponentProps<
            typeof Ionicons
          >['name'];
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Inicio" component={HomeScreen} options={{ title: 'Início' }} />
      <Tab.Screen name="Reservas" component={ReservationsScreen} />
      <Tab.Screen name="Acessos" component={AccessScreen} />
      <Tab.Screen name="Notificacoes" component={NotificationsScreen} options={{ title: 'Notificações' }} />
      <Tab.Screen name="Perfil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function BootSplash(): React.JSX.Element {
  return (
    <View style={styles.boot}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

export function AppNavigator(): React.JSX.Element {
  const { user, isRestoring } = useAuth();
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);

  if (isRestoring) return <BootSplash />;

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator screenOptions={{
        animation: reduceMotion ? 'none' : 'slide_from_right',
        gestureDirection: 'horizontal',
        gestureEnabled: !reduceMotion,
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        transitionSpec: {
          open: { animation: 'timing', config: { duration: 280, easing: Easing.out(Easing.cubic) } },
          close: { animation: 'timing', config: { duration: 240, easing: Easing.out(Easing.cubic) } },
        },
        cardStyle: { flex: 1, backgroundColor: colors.background },
        cardShadowEnabled: false,
        cardOverlayEnabled: false,
        headerMode: 'screen',
      }}>
        {user ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="Comunicados" component={NoticesScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Comunicado" component={NoticeDetailScreen} options={{ headerShown: false }} />
            <Stack.Screen
              name="EmBreve"
              component={ComingSoonScreen}
              options={({ route }) => ({
                title: route.params.title,
                headerBackTitle: 'Voltar',
                headerTintColor: colors.textOnBrand,
                headerTitleStyle: styles.headerTitle,
                headerStyle: styles.header,
              })}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    height: layout.minTouchTarget + spacing.xxl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  tabBarItem: {
    minHeight: layout.minTouchTarget,
  },
  tabBarLabel: {
    ...typography.micro,
  },
  header: {
    backgroundColor: colors.brand,
  },
  headerTitle: {
    ...typography.subtitle,
    color: colors.textOnBrand,
  },
});
