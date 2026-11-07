import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LoginScreen } from '../screens/LoginScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ReservationsScreen } from '../screens/ReservationsScreen';
import { IncidentsScreen } from '../screens/IncidentsScreen';
import { ComingSoonScreen } from '../screens/ComingSoonScreen';
import { NoticeDetailScreen, NoticesScreen } from '../screens/NoticesScreen';
import { EventDetailScreen, EventsScreen } from '../screens/EventsScreen';
import { VotingsScreen } from '../screens/VotingsScreen';
import { InvoicesScreen } from '../screens/InvoicesScreen';
import { InvoiceDetailScreen } from '../screens/InvoiceDetailScreen';
import { VehiclesPetsScreen } from '../screens/VehiclesPetsScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { useAuth } from '../contexts/AuthContext';
import { colors, fontFamily, layout, spacing, typography } from '../theme';
import type { MainTabParamList, RootStackParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();
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

const TAB_ICONS: Record<keyof MainTabParamList, [active: string, inactive: string]> = {
  Inicio: ['home', 'home-outline'],
  Reservas: ['calendar', 'calendar-outline'],
  Cobrancas: ['receipt', 'receipt-outline'],
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
      <Tab.Screen
        name="Cobrancas"
        component={InvoicesScreen}
        options={{
          title: 'Cobranças',
          headerShown: true,
          headerStyle: styles.header,
          headerTitleStyle: styles.headerTitle,
          headerTintColor: colors.textOnBrand,
          headerShadowVisible: false,
        }}
      />
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

  if (isRestoring) return <BootSplash />;

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator screenOptions={{
        headerBackTitle: 'Voltar',
        headerTintColor: colors.textOnBrand,
        headerTitleStyle: styles.headerTitle,
        headerStyle: styles.header,
        headerShadowVisible: false,
      }}>
        {user ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="Ocorrencias" component={IncidentsScreen} options={{ title: 'Ocorrências' }} />
            {/* Comunicados, eventos e votações desenham o próprio cabeçalho com botão de voltar. */}
            <Stack.Screen name="Comunicados" component={NoticesScreen} options={{ headerShown: false, title: 'Comunicados' }} />
            <Stack.Screen name="Comunicado" component={NoticeDetailScreen} options={{ headerShown: false, title: 'Comunicado' }} />
            <Stack.Screen name="Eventos" component={EventsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Evento" component={EventDetailScreen} options={{ headerShown: false, title: 'Evento' }} />
            <Stack.Screen name="Votacoes" component={VotingsScreen} options={{ headerShown: false, title: 'Votações' }} />
            <Stack.Screen name="FaturaDetalhe" component={InvoiceDetailScreen} options={{ title: 'Fatura' }} />
            <Stack.Screen name="VeiculosPets" component={VehiclesPetsScreen} options={{ title: 'Veículos e pets' }} />
            <Stack.Screen name="Notificacoes" component={NotificationsScreen} options={{ title: 'Notificações' }} />
            <Stack.Screen
              name="EmBreve"
              component={ComingSoonScreen}
              options={({ route }) => ({
                title: route.params.title,
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
