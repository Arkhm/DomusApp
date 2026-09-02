import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LoginScreen } from '../screens/LoginScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ComingSoonScreen, TabPlaceholder } from '../screens/ComingSoonScreen';
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

function PackagesScreen(): React.JSX.Element {
  return (
    <TabPlaceholder
      title="Encomendas"
      description="A API ainda não expõe /packages para consultar entregas na portaria."
    />
  );
}

const TAB_ICONS: Record<keyof MainTabParamList, [active: string, inactive: string]> = {
  Inicio: ['home', 'home-outline'],
  Reservas: ['calendar', 'calendar-outline'],
  Acessos: ['key', 'key-outline'],
  Encomendas: ['cube', 'cube-outline'],
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
      <Tab.Screen name="Encomendas" component={PackagesScreen} />
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
      <Stack.Navigator>
        {user ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen
              name="EmBreve"
              component={ComingSoonScreen}
              options={({ route }) => ({
                title: route.params.title,
                headerBackTitle: 'Voltar',
                headerTintColor: colors.textOnBrand,
                headerTitleStyle: styles.headerTitle,
                headerStyle: styles.header,
                headerShadowVisible: false,
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
