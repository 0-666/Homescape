/**
 * Property Module-Based Routing Demonstration
 * 
 * This file demonstrates how the property service routes operations
 * to appropriate module handlers based on property type.
 * 
 * Task 3.4: Create module-based property operation routing
 * Requirement 12.3: Route property operations to appropriate Property_Module
 */

import * as propertyService from '../services/property.service';
import * as moduleRegistry from '../services/module-registry.service';

/**
 * Example 1: Creating properties with different module types
 * 
 * The property service automatically routes to the appropriate module
 * and validates data against that module's schema.
 */
async function demonstrateModuleBasedCreation() {
  console.log('=== Example 1: Module-Based Property Creation ===\n');

  // Apartment module property
  try {
    const apartment = await propertyService.createProperty({
      builderId: 'builder-uuid-1',
      moduleType: 'APARTMENT',
      title: 'Downtown Luxury Apartment',
      price: 450000,
      location: 'Downtown',
      moduleData: {
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1200,
        floor: 15,
        amenities: ['pool', 'gym'],
      },
    });
    console.log('✓ Apartment property created:', apartment.id);
    console.log('  Module type:', apartment.moduleType);
    console.log('  Module data validated against APARTMENT schema\n');
  } catch (error) {
    console.error('✗ Failed to create apartment:', error);
  }

  // Future: Rental module property
  try {
    const rental = await propertyService.createProperty({
      builderId: 'builder-uuid-1',
      moduleType: 'RENTAL',
      title: 'Cozy Studio for Rent',
      price: 1500, // Monthly rent
      location: 'Suburbs',
      moduleData: {
        bedrooms: 1,
        bathrooms: 1,
        sqft: 600,
        monthly_rent: 1500,
        lease_term_months: 12,
        deposit_amount: 3000,
        pet_friendly: true,
      },
    });
    console.log('✓ Rental property created:', rental.id);
    console.log('  Module type:', rental.moduleType);
    console.log('  Module data validated against RENTAL schema\n');
  } catch (error) {
    console.log('✗ RENTAL module not yet registered (expected)\n');
  }
}

/**
 * Example 2: Module validation enforcement
 * 
 * The service rejects properties that don't conform to module schema
 */
async function demonstrateModuleValidation() {
  console.log('=== Example 2: Module Schema Validation ===\n');

  // Valid apartment data
  try {
    await propertyService.createProperty({
      builderId: 'builder-uuid-1',
      moduleType: 'APARTMENT',
      title: 'Valid Apartment',
      price: 300000,
      location: 'City Center',
      moduleData: {
        bedrooms: 3,
        bathrooms: 2,
        sqft: 1500,
      },
    });
    console.log('✓ Valid apartment data accepted\n');
  } catch (error) {
    console.error('✗ Unexpected error:', error);
  }

  // Invalid apartment data - missing required fields
  try {
    await propertyService.createProperty({
      builderId: 'builder-uuid-1',
      moduleType: 'APARTMENT',
      title: 'Invalid Apartment',
      price: 300000,
      location: 'City Center',
      moduleData: {
        // Missing required: bedrooms, bathrooms, sqft
        floor: 5,
      },
    });
    console.log('✗ Invalid data should have been rejected');
  } catch (error) {
    console.log('✓ Invalid apartment data rejected (expected)');
    console.log('  Error:', (error as Error).message, '\n');
  }

  // Invalid apartment data - wrong field types
  try {
    await propertyService.createProperty({
      builderId: 'builder-uuid-1',
      moduleType: 'APARTMENT',
      title: 'Invalid Apartment',
      price: 300000,
      location: 'City Center',
      moduleData: {
        bedrooms: 'two', // Should be number
        bathrooms: 2,
        sqft: 1500,
      },
    });
    console.log('✗ Invalid types should have been rejected');
  } catch (error) {
    console.log('✓ Invalid field types rejected (expected)');
    console.log('  Error:', (error as Error).message, '\n');
  }
}

/**
 * Example 3: Module-based querying
 * 
 * Properties can be queried by module type, demonstrating routing
 */
async function demonstrateModuleBasedQuerying() {
  console.log('=== Example 3: Module-Based Querying ===\n');

  // Get all apartment properties
  const apartments = await propertyService.getPropertiesByModule('APARTMENT');
  console.log(`✓ Found ${apartments.total} apartment properties`);
  console.log('  All properties have moduleType: APARTMENT\n');

  // Get properties for a specific builder
  const builderProperties = await propertyService.getPropertiesByBuilder('builder-uuid-1');
  console.log(`✓ Found ${builderProperties.total} properties for builder`);
  console.log('  Properties may span multiple module types\n');

  // Filter by module type and status
  const availableApartments = await propertyService.listProperties({
    moduleType: 'APARTMENT',
    status: 'AVAILABLE',
  });
  console.log(`✓ Found ${availableApartments.total} available apartments`);
  console.log('  Filtered by both module type and status\n');
}

/**
 * Example 4: Module-based updates
 * 
 * Updates are validated against the property's module schema
 */
async function demonstrateModuleBasedUpdates() {
  console.log('=== Example 4: Module-Based Updates ===\n');

  // Create a property first
  const property = await propertyService.createProperty({
    builderId: 'builder-uuid-1',
    moduleType: 'APARTMENT',
    title: 'Apartment to Update',
    price: 300000,
    location: 'City Center',
    moduleData: {
      bedrooms: 2,
      bathrooms: 1,
      sqft: 1000,
    },
  });

  // Valid update - module data conforms to schema
  try {
    await propertyService.updateProperty(property.id, {
      moduleData: {
        bedrooms: 3,
        bathrooms: 2,
        sqft: 1200,
        floor: 10,
      },
    });
    console.log('✓ Valid module data update accepted\n');
  } catch (error) {
    console.error('✗ Unexpected error:', error);
  }

  // Invalid update - missing required fields
  try {
    await propertyService.updateProperty(property.id, {
      moduleData: {
        floor: 15, // Missing required fields
      },
    });
    console.log('✗ Invalid update should have been rejected');
  } catch (error) {
    console.log('✓ Invalid module data update rejected (expected)');
    console.log('  Error:', (error as Error).message, '\n');
  }
}

/**
 * Example 5: Cross-module operations
 * 
 * Demonstrates how the system handles multiple module types
 */
async function demonstrateCrossModuleOperations() {
  console.log('=== Example 5: Cross-Module Operations ===\n');

  // List all active modules
  const modules = await moduleRegistry.listModules(true);
  console.log(`✓ Found ${modules.length} active module(s):`);
  modules.forEach((module) => {
    console.log(`  - ${module.type} (v${module.version})`);
  });
  console.log();

  // Get properties across all modules
  const allProperties = await propertyService.listProperties();
  console.log(`✓ Total properties across all modules: ${allProperties.total}`);

  // Group by module type
  const byModule = allProperties.properties.reduce((acc, prop) => {
    acc[prop.moduleType] = (acc[prop.moduleType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('  Properties by module type:');
  Object.entries(byModule).forEach(([type, count]) => {
    console.log(`    ${type}: ${count}`);
  });
  console.log();
}

/**
 * Main demonstration function
 */
export async function runPropertyModuleRoutingDemo() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Property Module-Based Routing Demonstration              ║');
  console.log('║  Task 3.4: Module-based property operation routing        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    await demonstrateModuleBasedCreation();
    await demonstrateModuleValidation();
    await demonstrateModuleBasedQuerying();
    await demonstrateModuleBasedUpdates();
    await demonstrateCrossModuleOperations();

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  Demonstration Complete                                    ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
  } catch (error) {
    console.error('Demonstration failed:', error);
  }
}

/**
 * Key Takeaways:
 * 
 * 1. Module-Based Routing: Every property operation is routed through
 *    the module registry to ensure proper validation and handling.
 * 
 * 2. Schema Validation: Module-specific data is validated against the
 *    module's schema, ensuring data integrity.
 * 
 * 3. Type Safety: The system prevents invalid data from being stored
 *    by enforcing module schemas at the service layer.
 * 
 * 4. Flexibility: New module types can be added without changing the
 *    property service code - just register a new module.
 * 
 * 5. Unified Interface: All property types use the same CRUD operations,
 *    with module-specific logic handled transparently.
 */

// Run if executed directly
if (require.main === module) {
  runPropertyModuleRoutingDemo()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
