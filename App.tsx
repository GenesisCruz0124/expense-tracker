import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DatabaseProvider } from './src/context/DatabaseProvider';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <DatabaseProvider>
        <NavigationContainer>
          <RootNavigator />
          <StatusBar style="auto" />
        </NavigationContainer>
      </DatabaseProvider>
    </SafeAreaProvider>
  );
}
