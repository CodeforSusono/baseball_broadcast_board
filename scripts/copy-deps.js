/**
 * Copy Dependencies Script
 *
 * This script copies required files from node_modules to the static file directories.
 * It runs automatically after npm install via the postinstall hook.
 */

const fs = require('fs');
const path = require('path');

// Define source and destination mappings
const filesToCopy = [
  // Bootstrap CSS
  {
    src: 'node_modules/bootstrap/dist/css/bootstrap.min.css',
    dest: 'public/css/bootstrap.min.css'
  },
  {
    src: 'node_modules/bootstrap/dist/css/bootstrap.min.css.map',
    dest: 'public/css/bootstrap.min.css.map'
  },
  // Bootstrap JavaScript
  {
    src: 'node_modules/bootstrap/dist/js/bootstrap.bundle.min.js',
    dest: 'public/js/bootstrap.bundle.min.js'
  },
  // Vue.js
  {
    src: 'node_modules/vue/dist/vue.global.js',
    dest: 'public/js/vue.global.js'
  }
];

/**
 * Copy a single file from source to destination
 * @param {string} src - Source file path
 * @param {string} dest - Destination file path
 */
function copyFile(src, dest) {
  try {
    // Check if source file exists
    if (!fs.existsSync(src)) {
      console.warn(`⚠️  Warning: Source file not found: ${src}`);
      return false;
    }

    // Ensure destination directory exists
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
      console.log(`📁 Created directory: ${destDir}`);
    }

    // Copy file
    fs.copyFileSync(src, dest);
    console.log(`✅ Copied: ${src} → ${dest}`);
    return true;
  } catch (error) {
    console.error(`❌ Error copying ${src} to ${dest}:`, error.message);
    return false;
  }
}

/**
 * Main execution
 */
function main() {
  console.log('🚀 Starting dependency copy process...\n');

  let successCount = 0;
  let failureCount = 0;

  filesToCopy.forEach(({ src, dest }) => {
    if (copyFile(src, dest)) {
      successCount++;
    } else {
      failureCount++;
    }
  });

  console.log('\n📊 Summary:');
  console.log(`   ✅ Successfully copied: ${successCount} file(s)`);

  if (failureCount > 0) {
    console.log(`   ❌ Failed: ${failureCount} file(s)`);
    console.log('\n⚠️  Some files could not be copied. Please check the warnings above.');
    process.exit(1);
  } else {
    console.log('\n🎉 All dependencies copied successfully!');
  }
}

// Run the script
main();
