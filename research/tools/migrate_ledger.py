#!/usr/bin/env python3
"""
Migrate contaminated ledger: mark mock test data, preserve real paid calls.

Usage:
    python3 tools/migrate_ledger.py research/ledger.db --backup --audit
"""

import argparse
import shutil
import sqlite3
import sys
from datetime import datetime
from pathlib import Path


def migrate_ledger(ledger_path: Path, backup: bool = True, dry_run: bool = False):
    """
    Mark mock test data in ledger while preserving real paid calls.
    
    Mock data identified by:
    - model_version contains '-mock'
    - actual_cost_usd suspiciously low (<$0.0001)
    - call_id patterns from test runs
    """
    if not ledger_path.exists():
        print(f"Ledger not found: {ledger_path}")
        return False
    
    # Backup
    if backup and not dry_run:
        backup_path = ledger_path.with_suffix(f'.db.backup-{datetime.now().strftime("%Y%m%d_%H%M%S")}')
        shutil.copy2(ledger_path, backup_path)
        print(f"✓ Backup created: {backup_path}")
    
    conn = sqlite3.connect(str(ledger_path))
    conn.row_factory = sqlite3.Row
    
    try:
        # Add missing columns idempotently (for legacy ledgers)
        cursor = conn.execute("PRAGMA table_info(calls)")
        columns = [row['name'] for row in cursor.fetchall()]
        
        columns_to_add = []
        if 'mock_data' not in columns:
            columns_to_add.append(("mock_data", "INTEGER DEFAULT 0"))
        if 'error' not in columns:
            columns_to_add.append(("error", "TEXT"))
        if 'finish_reason' not in columns:
            columns_to_add.append(("finish_reason", "TEXT"))
        
        if columns_to_add and not dry_run:
            print(f"Adding missing columns: {', '.join(c[0] for c in columns_to_add)}")
            for col_name, col_def in columns_to_add:
                conn.execute(f"ALTER TABLE calls ADD COLUMN {col_name} {col_def}")
            conn.commit()
        elif columns_to_add and dry_run:
            print(f"[DRY RUN] Would add columns: {', '.join(c[0] for c in columns_to_add)}")
        
        # Identify mock data (NEVER by price alone - real gpt-oss can be $0.00097)
        # ONLY mark by explicit mock indicators
        mock_patterns = [
            "model_version LIKE '%-mock'",  # Explicit mock version suffix
            "experiment = 'test'",           # Test experiment name
        ]
        
        where_clause = " OR ".join(f"({p})" for p in mock_patterns)
        
        # Count mock rows
        cursor = conn.execute(f"""
            SELECT COUNT(*) as count, 
                   COALESCE(SUM(actual_cost_usd), 0) as cost
            FROM calls 
            WHERE ({where_clause}) AND mock_data = 0
        """)
        row = cursor.fetchone()
        mock_count = row['count']
        mock_cost = row['cost']
        
        # Count real paid rows
        cursor = conn.execute(f"""
            SELECT COUNT(*) as count,
                   COALESCE(SUM(actual_cost_usd), 0) as cost
            FROM calls
            WHERE NOT ({where_clause}) AND mock_data = 0
        """)
        row = cursor.fetchone()
        real_count = row['count']
        real_cost = row['cost']
        
        print("\nLedger Analysis:")
        print(f"  Real paid calls: {real_count} (${real_cost:.4f})")
        print(f"  Mock test calls: {mock_count} (${mock_cost:.4f})")
        
        if mock_count == 0:
            print("\n✓ No mock data found. Ledger is clean.")
            return True
        
        # Mark mock data
        if not dry_run:
            cursor = conn.execute(f"""
                UPDATE calls 
                SET mock_data = 1
                WHERE ({where_clause}) AND mock_data = 0
            """)
            affected = cursor.rowcount
            conn.commit()
            print(f"\n✓ Marked {affected} rows as mock_data=1")
            print("  (Mock rows excluded from billable totals but preserved for audit)")
        else:
            print("\n[DRY RUN] Would mark rows as mock_data=1")
        
        # Show sample mock rows
        print("\nSample mock rows:")
        cursor = conn.execute(f"""
            SELECT call_id, model_version, actual_cost_usd, experiment
            FROM calls
            WHERE ({where_clause})
            LIMIT 5
        """)
        for row in cursor.fetchall():
            print(f"  {row['call_id'][:50]:50s} {row['model_version']:20s} ${row['actual_cost_usd']:.6f} {row['experiment']}")
        
        # Verify billable total
        cursor = conn.execute("""
            SELECT COUNT(*) as count,
                   COALESCE(SUM(actual_cost_usd), 0) as cost
            FROM calls
            WHERE mock_data = 0
        """)
        row = cursor.fetchone()
        billable_count = row['count']
        billable_cost = row['cost']
        
        print(f"\n✓ Billable total (mock_data=0): {billable_count} calls, ${billable_cost:.4f}")
        
        return True
        
    finally:
        conn.close()


def audit_ledger(ledger_path: Path):
    """Print audit report of ledger contents."""
    if not ledger_path.exists():
        print(f"Ledger not found: {ledger_path}")
        return
    
    conn = sqlite3.connect(str(ledger_path))
    conn.row_factory = sqlite3.Row
    
    try:
        # Check schema
        cursor = conn.execute("PRAGMA table_info(calls)")
        columns = [row['name'] for row in cursor.fetchall()]
        has_mock_column = 'mock_data' in columns
        has_error_column = 'error' in columns
        
        print(f"\nLedger Schema:")
        print(f"  mock_data column: {'✓' if has_mock_column else '✗ (add with --migrate)'}")
        print(f"  error column: {'✓' if has_error_column else '✗'}")
        
        # Overall stats
        cursor = conn.execute("""
            SELECT 
                COUNT(*) as total_calls,
                COUNT(DISTINCT experiment) as experiments,
                COUNT(DISTINCT model_id) as models,
                COALESCE(SUM(actual_cost_usd), 0) as total_cost,
                COALESCE(SUM(CASE WHEN mock_data = 1 THEN actual_cost_usd ELSE 0 END), 0) as mock_cost
            FROM calls
        """)
        row = cursor.fetchone()
        
        print(f"\nOverall:")
        print(f"  Total calls: {row['total_calls']}")
        print(f"  Experiments: {row['experiments']}")
        print(f"  Models: {row['models']}")
        print(f"  Total cost: ${row['total_cost']:.4f}")
        if has_mock_column:
            billable = row['total_cost'] - row['mock_cost']
            print(f"  Billable (excluding mock): ${billable:.4f}")
        
        # Per-experiment breakdown
        print(f"\nBy Experiment:")
        cursor = conn.execute("""
            SELECT 
                experiment,
                COUNT(*) as calls,
                COALESCE(SUM(actual_cost_usd), 0) as cost,
                COALESCE(SUM(CASE WHEN mock_data = 1 THEN 1 ELSE 0 END), 0) as mock_calls
            FROM calls
            GROUP BY experiment
            ORDER BY experiment
        """)
        for row in cursor.fetchall():
            mock_str = f" ({row['mock_calls']} mock)" if has_mock_column and row['mock_calls'] > 0 else ""
            print(f"  {row['experiment']:15s}: {row['calls']:4d} calls, ${row['cost']:.4f}{mock_str}")
        
        # Failed calls
        if has_error_column:
            cursor = conn.execute("""
                SELECT COUNT(*) as count FROM calls WHERE error IS NOT NULL
            """)
            failed = cursor.fetchone()['count']
            if failed > 0:
                print(f"\nFailed Calls: {failed}")
                cursor = conn.execute("""
                    SELECT call_id, error FROM calls WHERE error IS NOT NULL LIMIT 3
                """)
                for row in cursor.fetchall():
                    print(f"  {row['call_id'][:50]:50s} {row['error'][:60]}")
        
        # Unreleased reservations
        cursor = conn.execute("""
            SELECT COUNT(*) as count,
                   COALESCE(SUM(reserved_usd), 0) as total
            FROM reservations
            WHERE reconciled = 0
        """)
        row = cursor.fetchone()
        if row['count'] > 0:
            print(f"\n⚠️  Unreleased Reservations: {row['count']} (${row['total']:.4f})")
        
    finally:
        conn.close()


def restore_wrongly_marked(ledger_path: Path, dry_run: bool = False) -> bool:
    """
    Restore real paid calls wrongly marked as mock by cost heuristic.
    
    Identifies rows with genuine provenance:
    - Non-mock model_version (no '-mock' suffix)
    - experiment != 'test'
    - Non-zero cost
    """
    conn = sqlite3.connect(ledger_path)
    conn.row_factory = sqlite3.Row
    
    try:
        # Find wrongly marked rows
        cursor = conn.execute("""
            SELECT call_id, model_id, model_version, actual_cost_usd, experiment, timestamp
            FROM calls
            WHERE mock_data = 1
              AND model_version NOT LIKE '%-mock'
              AND experiment != 'test'
              AND actual_cost_usd > 0
            ORDER BY timestamp
        """)
        
        wrongly_marked = cursor.fetchall()
        
        if not wrongly_marked:
            print("\n✓ No wrongly marked mock rows found")
            return True
        
        print(f"\n⚠ Found {len(wrongly_marked)} real calls wrongly marked as mock:")
        print(f"{'Call ID':<50} {'Model':<25} {'Cost':>12} {'Experiment':<10}")
        print("-" * 105)
        
        total_cost = 0.0
        for row in wrongly_marked:
            print(f"{row['call_id'][:48]:<50} {row['model_version']:<25} ${row['actual_cost_usd']:>10.6f} {row['experiment']:<10}")
            total_cost += row['actual_cost_usd']
        
        print("-" * 105)
        print(f"Total wrongly marked cost: ${total_cost:.4f}")
        
        if not dry_run:
            cursor = conn.execute("""
                UPDATE calls
                SET mock_data = 0
                WHERE mock_data = 1
                  AND model_version NOT LIKE '%-mock'
                  AND experiment != 'test'
                  AND actual_cost_usd > 0
            """)
            affected = cursor.rowcount
            conn.commit()
            print(f"\n✓ Restored {affected} rows to real (mock_data=0)")
        else:
            print(f"\n[DRY RUN] Would restore {len(wrongly_marked)} rows")
        
        return True
    
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Migrate contaminated ledger: mark mock data, restore wrongly marked real calls"
    )
    parser.add_argument("ledger_path", type=Path, help="Path to ledger.db")
    parser.add_argument("--backup", action="store_true", help="Create backup before migrating")
    parser.add_argument("--audit", action="store_true", help="Print audit report")
    parser.add_argument("--restore", action="store_true", help="Restore wrongly marked real calls")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done")
    
    args = parser.parse_args()
    
    if args.audit:
        audit_ledger(args.ledger_path)
    elif args.restore:
        restore_wrongly_marked(args.ledger_path, dry_run=args.dry_run)
        audit_ledger(args.ledger_path)
    else:
        success = migrate_ledger(args.ledger_path, backup=args.backup, dry_run=args.dry_run)
        if success:
            print("\n✓ Migration complete")
            audit_ledger(args.ledger_path)
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
