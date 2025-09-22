export interface Migration {
  version: number;
  name: string;
  up: string[];
  down: string[];
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'create_alpacas_table',
    up: [
      `CREATE TABLE alpacas (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        registration_number TEXT UNIQUE,
        birth_date DATE NOT NULL,
        gender TEXT CHECK (gender IN ('male', 'female')) NOT NULL,
        color TEXT NOT NULL,
        weight REAL,
        height REAL,
        fiber_micron_count REAL,
        fiber_staple_length REAL,
        fiber_crimp TEXT,
        fiber_density TEXT,
        sire_id TEXT REFERENCES alpacas(id),
        dam_id TEXT REFERENCES alpacas(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX idx_alpacas_registration ON alpacas(registration_number)`,
      `CREATE INDEX idx_alpacas_birth_date ON alpacas(birth_date)`,
      `CREATE INDEX idx_alpacas_parents ON alpacas(sire_id, dam_id)`
    ],
    down: [
      `DROP INDEX IF EXISTS idx_alpacas_parents`,
      `DROP INDEX IF EXISTS idx_alpacas_birth_date`,
      `DROP INDEX IF EXISTS idx_alpacas_registration`,
      `DROP TABLE IF EXISTS alpacas`
    ]
  },
  {
    version: 2,
    name: 'create_health_records_table',
    up: [
      `CREATE TABLE health_records (
        id TEXT PRIMARY KEY,
        alpaca_id TEXT NOT NULL REFERENCES alpacas(id) ON DELETE CASCADE,
        record_type TEXT NOT NULL,
        date DATE NOT NULL,
        description TEXT NOT NULL,
        veterinarian TEXT,
        next_due_date DATE,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX idx_health_alpaca_date ON health_records(alpaca_id, date)`,
      `CREATE INDEX idx_health_due_date ON health_records(next_due_date)`
    ],
    down: [
      `DROP INDEX IF EXISTS idx_health_due_date`,
      `DROP INDEX IF EXISTS idx_health_alpaca_date`,
      `DROP TABLE IF EXISTS health_records`
    ]
  },
  {
    version: 3,
    name: 'create_breeding_records_table',
    up: [
      `CREATE TABLE breeding_records (
        id TEXT PRIMARY KEY,
        sire_id TEXT NOT NULL REFERENCES alpacas(id),
        dam_id TEXT NOT NULL REFERENCES alpacas(id),
        breeding_date DATE NOT NULL,
        expected_due_date DATE,
        actual_birth_date DATE,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE breeding_offspring (
        breeding_id TEXT REFERENCES breeding_records(id) ON DELETE CASCADE,
        offspring_id TEXT REFERENCES alpacas(id) ON DELETE CASCADE,
        PRIMARY KEY (breeding_id, offspring_id)
      )`,
      `CREATE INDEX idx_breeding_parents ON breeding_records(sire_id, dam_id)`,
      `CREATE INDEX idx_breeding_date ON breeding_records(breeding_date)`
    ],
    down: [
      `DROP INDEX IF EXISTS idx_breeding_date`,
      `DROP INDEX IF EXISTS idx_breeding_parents`,
      `DROP TABLE IF EXISTS breeding_offspring`,
      `DROP TABLE IF EXISTS breeding_records`
    ]
  },
  {
    version: 4,
    name: 'create_management_activities_table',
    up: [
      `CREATE TABLE management_activities (
        id TEXT PRIMARY KEY,
        activity_type TEXT NOT NULL,
        date DATE NOT NULL,
        performed_by TEXT NOT NULL,
        description TEXT NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE activity_alpacas (
        activity_id TEXT REFERENCES management_activities(id) ON DELETE CASCADE,
        alpaca_id TEXT REFERENCES alpacas(id) ON DELETE CASCADE,
        PRIMARY KEY (activity_id, alpaca_id)
      )`,
      `CREATE INDEX idx_activities_date ON management_activities(date)`,
      `CREATE INDEX idx_activities_type ON management_activities(activity_type)`
    ],
    down: [
      `DROP INDEX IF EXISTS idx_activities_type`,
      `DROP INDEX IF EXISTS idx_activities_date`,
      `DROP TABLE IF EXISTS activity_alpacas`,
      `DROP TABLE IF EXISTS management_activities`
    ]
  }

];

// Helper function to get the latest migration version
export function getLatestMigrationVersion(): number {
  return Math.max(...migrations.map(m => m.version));
}

// Helper function to get migration by version
export function getMigrationByVersion(version: number): Migration | undefined {
  return migrations.find(m => m.version === version);
}

// Helper function to get migrations up to a specific version
export function getMigrationsUpTo(version: number): Migration[] {
  return migrations
    .filter(m => m.version <= version)
    .sort((a, b) => a.version - b.version);
}

// Helper function to get migrations from a specific version down to another
export function getMigrationsFromTo(fromVersion: number, toVersion: number): Migration[] {
  return migrations
    .filter(m => m.version > toVersion && m.version <= fromVersion)
    .sort((a, b) => b.version - a.version); // Reverse order for rollback
}