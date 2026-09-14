const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const gameSource = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-maze-game.js'), 'utf8');
const multiplayerSource = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-multiplayer.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase', 'maze_records_20260905.sql'), 'utf8');
const validationMigration = fs.readFileSync(path.join(root, 'supabase', 'maze_validation_20260905.sql'), 'utf8');

assert.match(migration, /create table if not exists public\.mall_maze_records/i);
assert.match(migration, /alter table public\.mall_maze_records enable row level security/i);
assert.match(migration, /revoke all on public\.mall_maze_records from public, anon, authenticated/i);
assert.match(migration, /create or replace function public\.get_mall_maze_records\(\s*p_limit integer/i);
assert.match(migration, /create or replace function public\.submit_mall_maze_record\(\s*p_player_name text,\s*p_elapsed_ms integer/i);
assert.match(migration, /security definer\s+set search_path = public, pg_temp/i);
assert.match(migration, /grant execute on function public\.get_mall_maze_records\(integer\) to anon, authenticated/i);
assert.match(migration, /grant execute on function public\.submit_mall_maze_record\(text, integer\) to anon, authenticated/i);
assert.doesNotMatch(migration, /grant\s+(select|insert|update|delete|all)\s+on\s+public\.mall_maze_records\s+to\s+(anon|authenticated)/i);

assert.match(gameSource, /const RECORDS_READ_RPC = 'get_mall_maze_records'/);
assert.match(gameSource, /const RECORDS_START_RPC = 'start_mall_maze_run'/);
assert.match(gameSource, /const RECORDS_CHECKPOINT_RPC = 'record_mall_maze_checkpoint'/);
assert.match(gameSource, /const RECORDS_WRITE_RPC = 'submit_mall_maze_record_v2'/);
assert.match(gameSource, /await client\.rpc\(RECORDS_WRITE_RPC/);
assert.match(gameSource, /await client\.rpc\(RECORDS_READ_RPC/);
assert.match(gameSource, /await client\.rpc\(RECORDS_START_RPC/);
assert.match(gameSource, /await client\.rpc\(RECORDS_CHECKPOINT_RPC/);
assert.match(gameSource, /state\.globalRecordsAvailable = true/);
assert.match(gameSource, /mall-maze-records-v1/);
assert.match(multiplayerSource, /window\.mallSupabaseClient = supabaseClient/);

assert.match(validationMigration, /create table if not exists public\.mall_maze_runs/i);
assert.match(validationMigration, /create or replace function public\.start_mall_maze_run/i);
assert.match(validationMigration, /create or replace function public\.record_mall_maze_checkpoint/i);
assert.match(validationMigration, /create or replace function public\.submit_mall_maze_record_v2/i);
assert.match(validationMigration, /last_checkpoint < current_run\.checkpoint_count/i);
assert.match(validationMigration, /grant execute on function public\.start_mall_maze_run\(text, text, integer\) to anon, authenticated/i);
assert.match(validationMigration, /grant execute on function public\.record_mall_maze_checkpoint\(uuid, integer, integer\) to anon, authenticated/i);
assert.match(validationMigration, /grant execute on function public\.submit_mall_maze_record_v2\(uuid, text, integer\) to anon, authenticated/i);

console.log('Supabase maze records contract verified: protected table, RPCs, and local fallback.');
