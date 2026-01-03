// Test file to verify TypeScript resolves @nextsparkjs/core imports correctly
// This file is for verification only and can be deleted after testing

// Test import from main entry point
import { cn } from '@nextsparkjs/core'

// If TypeScript compiles this without errors, self-referencing works
export const testImport: boolean = true
export const testCn = cn
