/**
 * Development environment configuration
 * 
 * For mobile development:
 * - Physical devices: Replace 'localhost' with your computer's local IP address
 *   Example: 'http://192.168.1.100:3000/api'
 * - iOS Simulator: Can use 'localhost' or '127.0.0.1'
 * - Android Emulator: Use '10.0.2.2' instead of 'localhost'
 * 
 * To change the API URL, edit this file directly or use Angular's fileReplacements
 * in angular.json for different build configurations.
 */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
};
