/**
 * Script to register the Apartment module in the property module registry
 * This is a reference implementation for the modular property type system
 */

import { registerModule, getModule } from '../services/module-registry.service';
import { apartmentModuleRegistration, APARTMENT_MODULE_TYPE } from '../modules/apartment.module';

/**
 * Register the Apartment module
 */
export async function registerApartmentModule() {
  try {
    // Check if module already exists
    const existingModule = await getModule(APARTMENT_MODULE_TYPE);
    
    if (existingModule) {
      console.log('Apartment module already registered');
      return existingModule;
    }

    // Register the module
    const module = await registerModule(apartmentModuleRegistration);

    console.log('Apartment module registered successfully:', module);
    return module;
  } catch (error) {
    console.error('Failed to register Apartment module:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  registerApartmentModule()
    .then(() => {
      console.log('Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}
