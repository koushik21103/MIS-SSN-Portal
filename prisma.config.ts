import path from 'node:path'
import { defineConfig } from 'prisma/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

// Load .env.local for local development
import 'dotenv/config'

export default defineConfig({
  earlyAccess: true,
  schema: path.join(process.cwd(), 'prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL!,
  },
  migrate: {
    async adapter() {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
      return new PrismaPg(pool)
    },
  },
})
