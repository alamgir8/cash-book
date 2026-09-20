#!/usr/bin/env node
/**
 * Sync the "flavor" (Debug vs Release) of every precompiled native binary in ios/Pods.
 *
 * WHY THIS EXISTS
 * ---------------
 * React Native and Expo ship most of the heavy native code as prebuilt xcframeworks,
 * each in two flavors: `debug` and `release`. The binaries are NOT interchangeable:
 *
 *   - Debug-flavored React core exports Debug-only classes such as RCTPackagerConnection.
 *     `expo-dev-launcher` is compiled from source in a Debug build and references it, so
 *     building Debug against a Release-flavored core fails to link with:
 *       Undefined symbols for architecture arm64: _OBJC_CLASS_$_RCTPackagerConnection
 *   - Conversely, linking a Release-flavored ExpoModulesCore against a Debug-flavored core
 *     causes an ABI mismatch and the app crashes on launch (SIGSEGV in
 *     expo::ExpoViewProps -> facebook::react::Props::Props()).
 *
 * Both RN and Expo are supposed to swap the correct flavor during the Xcode build, but the
 * swap is gated on a marker file (`.last_build_configuration`). If that marker goes missing,
 * or is reset by a `pod install` without re-extracting the tarball, the guard scripts assume
 * "already built for Debug" and silently skip the swap. The result is a Debug build linking
 * Release binaries.
 *
 * A caveat worth knowing: the marker only records intent, it is not proof of what is on disk.
 * This script therefore verifies by hashing the installed binary against both tarballs instead
 * of trusting the marker.
 *
 * WHEN TO RUN IT
 * --------------
 * After switching between Debug and Release builds (e.g. `expo run:ios --configuration Release`
 * followed by `expo run:ios --device`), or any time a Debug build fails to link / crashes on
 * launch for no obvious reason.
 *
 * USAGE
 * -----
 *   node scripts/sync-ios-prebuild-flavors.mjs                 # report + make everything Debug
 *   node scripts/sync-ios-prebuild-flavors.mjs --config release
 *   node scripts/sync-ios-prebuild-flavors.mjs --dry-run        # report only, change nothing
 *   node scripts/sync-ios-prebuild-flavors.mjs --force          # re-extract even if already correct
 *
 * The actual swapping is delegated to React Native's and Expo's own scripts so that the
 * resulting file layout matches exactly what their build phases expect.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOBILE_ROOT = path.resolve(__dirname, '..');
const NODE_MODULES = path.join(MOBILE_ROOT, 'node_modules');

const COLORS = process.stdout.isTTY
  ? { red: '\u001b[31m', green: '\u001b[32m', yellow: '\u001b[33m', dim: '\u001b[2m', bold: '\u001b[1m', reset: '\u001b[0m' }
  : { red: '', green: '', yellow: '', dim: '', bold: '', reset: '' };

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { config: 'debug', dryRun: false, force: false, pods: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '-c':
      case '--config': {
        const value = (argv[++i] || '').toLowerCase();
        if (value !== 'debug' && value !== 'release') {
          fail(`--config must be "debug" or "release" (got "${value}")`);
        }
        opts.config = value;
        break;
      }
      case '-p':
      case '--pods':
        opts.pods = path.resolve(argv[++i] || '');
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--force':
        opts.force = true;
        break;
      case '-h':
      case '--help':
        opts.help = true;
        break;
      default:
        fail(`Unknown argument "${arg}". Use --help.`);
    }
  }
  return opts;
}

function fail(message) {
  console.error(`\n${COLORS.red}error:${COLORS.reset} ${message}\n`);
  process.exit(2);
}

const HELP = `
Sync precompiled native pod flavors (Debug/Release) in ios/Pods.

  node scripts/sync-ios-prebuild-flavors.mjs [options]

Options:
  -c, --config <debug|release>  Target flavor to install (default: debug)
  -p, --pods <path>             Pods root (default: <mobile>/ios/Pods)
      --dry-run                 Only report what is installed, change nothing
      --force                   Re-extract even pods already on the target flavor
  -h, --help                    Show this help

Run this after switching between Debug and Release iOS builds.
`;

// ---------------------------------------------------------------------------
// Small fs / archive helpers
// ---------------------------------------------------------------------------

/** SHA-256 of a file, read in chunks so multi-hundred-MB frameworks stay cheap. */
function hashFile(file) {
  const hash = createHash('sha256');
  const fd = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(1 << 20);
    let bytesRead;
    while ((bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) {
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

/** SHA-256 of a single member inside a .tar.gz, without unpacking the whole archive. */
function hashTarMember(tarball, member) {
  try {
    const output = execFileSync('tar', ['-xzOf', tarball, member], {
      maxBuffer: 1 << 30,
    });
    return createHash('sha256').update(output).digest('hex');
  } catch {
    return null;
  }
}

/** Entries inside a .tar.gz. */
function listTar(tarball) {
  const output = execFileSync('tar', ['-tzf', tarball], {
    encoding: 'utf8',
    maxBuffer: 1 << 30,
  });
  return output.split('\n').filter(Boolean);
}

/**
 * Pick the arm64 device binary inside an xcframework tarball, e.g.
 *   React.xcframework/ios-arm64/React.framework/React
 *   packages/.../ReactNativeDependencies.xcframework/ios-arm64/ReactNativeDependencies.framework/ReactNativeDependencies
 *   ./destroot/Library/Frameworks/universal/hermesvm.xcframework/ios-arm64/hermesvm.framework/hermesvm
 *
 * `ios-arm64/` (with the trailing slash) deliberately does not match
 * `ios-arm64_x86_64-simulator/`, so we always compare the device slice.
 */
function pickDeviceBinary(entries) {
  const candidates = entries.filter((entry) => entry.includes('/ios-arm64/') && !entry.includes('/dSYMs/'));
  const frameworkBinaries = candidates.filter((entry) => {
    const parts = entry.split('/');
    return parts.at(-2) === `${parts.at(-1)}.framework`;
  });
  return (frameworkBinaries[0] || candidates[0])?.split('/ios-arm64/').at(-1) || null;
}

/** Recursively find files whose path ends with `<suffix>` while sitting under `/ios-arm64/`. */
function findInstalledBinaries(podDir, deviceSuffix) {
  const needle = `/ios-arm64/${deviceSuffix}`;
  const found = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'dSYMs') continue;
        walk(full);
      } else if (entry.isFile() && full.endsWith(needle)) {
        found.push(full);
      }
    }
  };
  walk(podDir);
  return found;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Target discovery
// ---------------------------------------------------------------------------

/**
 * Build the list of precompiled pods we can switch, along with the marker file each one
 * uses and the upstream script that performs the swap.
 */
function discoverTargets(podsRoot) {
  const targets = [];
  const rnVersion = readJson(path.join(NODE_MODULES, 'react-native', 'package.json'))?.version;

  // --- React Native's own precompiled artifacts -------------------------------------------
  if (rnVersion) {
    addTarget(targets, podsRoot, {
      name: 'React-Core-prebuilt',
      podDir: path.join(podsRoot, 'React-Core-prebuilt'),
      tarballs: (config) =>
        path.join(podsRoot, 'ReactNativeCore-artifacts', `reactnative-core-${rnVersion}-${config}.tar.gz`),
      marker: path.join(podsRoot, 'React-Core-prebuilt', '.last_build_configuration'),
      script: path.join(NODE_MODULES, 'react-native', 'scripts', 'replace-rncore-version.js'),
      scriptArgs: (config) => ['-c', config === 'debug' ? 'Debug' : 'Release', '-r', rnVersion, '-p', podsRoot],
    });

    addTarget(targets, podsRoot, {
      name: 'ReactNativeDependencies',
      podDir: path.join(podsRoot, 'ReactNativeDependencies'),
      tarballs: (config) =>
        path.join(
          podsRoot,
          'ReactNativeDependencies-artifacts',
          `reactnative-dependencies-${rnVersion}-${config}.tar.gz`,
        ),
      marker: path.join(podsRoot, 'ReactNativeDependencies', '.last_build_configuration'),
      script: path.join(NODE_MODULES, 'react-native', 'third-party-podspecs', 'replace_dependencies_version.js'),
      scriptArgs: (config) => ['-c', config === 'debug' ? 'Debug' : 'Release', '-r', rnVersion, '-p', podsRoot],
    });

    // Hermes is versioned independently of React Native, so read it off its own artifacts.
    const hermesArtifacts = path.join(podsRoot, 'hermes-engine-artifacts');
    const hermesVersion = fs.existsSync(hermesArtifacts)
      ? fs.readdirSync(hermesArtifacts)
          .map((file) => /^hermes-ios-(.+)-(?:debug|release)\.tar\.gz$/.exec(file)?.[1])
          .find(Boolean)
      : null;

    if (hermesVersion) {
      addTarget(targets, podsRoot, {
        name: 'hermes-engine',
        podDir: path.join(podsRoot, 'hermes-engine'),
        tarballs: (config) =>
          path.join(podsRoot, 'hermes-engine-artifacts', `hermes-ios-${hermesVersion}-${config}.tar.gz`),
        marker: path.join(podsRoot, '.last_build_configuration'),
        script: path.join(NODE_MODULES, 'react-native', 'sdks', 'hermes-engine', 'utils', 'replace_hermes_version.js'),
        scriptArgs: (config) => ['-c', config === 'debug' ? 'Debug' : 'Release', '-r', hermesVersion, '-p', podsRoot],
      });
    }
  }

  // --- Expo precompiled modules -----------------------------------------------------------
  // Any pod that carries `<Pod>/artifacts/<Pod>-{debug,release}.tar.gz` can be switched.
  const dropInScript = path.join(
    NODE_MODULES,
    'expo-modules-autolinking',
    'scripts',
    'ios',
    'replace-xcframework.js',
  );

  if (fs.existsSync(dropInScript)) {
    for (const entry of fs.readdirSync(podsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const podDir = path.join(podsRoot, entry.name);
      const artifactsDir = path.join(podDir, 'artifacts');
      const hasFlavors = ['debug', 'release'].every((config) =>
        fs.existsSync(path.join(artifactsDir, `${entry.name}-${config}.tar.gz`)),
      );
      if (!hasFlavors) continue;

      addTarget(targets, podsRoot, {
        name: entry.name,
        podDir,
        tarballs: (config) => path.join(artifactsDir, `${entry.name}-${config}.tar.gz`),
        marker: path.join(artifactsDir, '.last_build_configuration'),
        script: dropInScript,
        scriptArgs: (config) => ['-c', config, '-m', entry.name, '-x', podDir],
      });
    }
  }

  return targets;
}

function addTarget(targets, podsRoot, target) {
  const debugTarball = target.tarballs('debug');
  const releaseTarball = target.tarballs('release');
  if (!fs.existsSync(debugTarball) || !fs.existsSync(releaseTarball)) return;

  // `expo-dev-launcher/Unsafe` is compiled from source, so an absent pod dir just means
  // `pod install` has not run yet; skip rather than crash.
  if (!fs.existsSync(target.podDir)) return;

  const deviceSuffix = pickDeviceBinary(listTar(debugTarball));
  if (!deviceSuffix) return;

  targets.push({ ...target, debugTarball, releaseTarball, deviceSuffix });
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/**
 * Work out which flavor a pod actually has on disk by hashing its installed binary against
 * both tarballs. Returns { flavor, binaries } where flavor is 'debug' | 'release' | 'mixed'
 * | 'unknown' | 'missing'.
 */
function detectInstalledFlavor(target) {
  const binaries = findInstalledBinaries(target.podDir, target.deviceSuffix);
  if (binaries.length === 0) return { flavor: 'missing', binaries };

  const debugHash = hashTarMember(target.debugTarball, target.deviceSuffixInDebug ?? target.deviceSuffix);
  const releaseHash = hashTarMember(target.releaseTarball, target.deviceSuffixInRelease ?? target.deviceSuffix);

  const flavors = new Set();
  for (const binary of binaries) {
    const hash = hashFile(binary);
    if (hash === debugHash) flavors.add('debug');
    else if (hash === releaseHash) flavors.add('release');
    else flavors.add('unknown');
  }

  if (flavors.size > 1) return { flavor: 'mixed', binaries };
  return { flavor: [...flavors][0], binaries };
}

/**
 * The device binary lives at a different relative path in the tarball than on disk for some
 * pods (React Native Dependencies nests it under `third-party/`), so resolve the real member
 * name per tarball instead of assuming a single path.
 */
function resolveTarMember(tarball, deviceSuffix) {
  const entries = listTar(tarball);
  const match = entries.find((entry) => entry.includes('/ios-arm64/') && entry.endsWith(`/ios-arm64/${deviceSuffix}`));
  return match || deviceSuffix;
}

// ---------------------------------------------------------------------------
// Swap
// ---------------------------------------------------------------------------

function forceSwap(target, config) {
  const markerValue = config === 'debug' ? 'debug' : 'release';
  const wrongValue = config === 'debug' ? 'release' : 'debug';

  // Upstream guards skip the swap when the marker already matches the config, and RN's guards
  // additionally assume "no marker + Debug == nothing to do". Writing the opposite value first
  // forces the swap in every case, including a missing marker on a Debug build.
  fs.mkdirSync(path.dirname(target.marker), { recursive: true });
  fs.writeFileSync(target.marker, wrongValue);

  try {
    execFileSync(process.execPath, [target.script, ...target.scriptArgs(config)], {
      cwd: target.podsRoot,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: (error.stderr || error.message || '').trim().split('\n').slice(-4).join(' ') };
  } finally {
    // Leave the marker describing reality even if the swap script bailed out early.
    if (fs.existsSync(target.marker)) {
      const written = fs.readFileSync(target.marker, 'utf8').trim();
      const expected = target.name === 'React-Core-prebuilt' ||
        target.name === 'ReactNativeDependencies' ||
        target.name === 'hermes-engine'
        ? (config === 'debug' ? 'Debug' : 'Release')
        : markerValue;
      if (written === wrongValue) fs.writeFileSync(target.marker, expected);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function colorFor(flavor, config) {
  if (flavor === config) return COLORS.green;
  if (flavor === 'missing' || flavor === 'unknown' || flavor === 'mixed') return COLORS.yellow;
  return COLORS.red;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(HELP);
    return;
  }

  const podsRoot = opts.pods || path.join(MOBILE_ROOT, 'ios', 'Pods');
  if (!fs.existsSync(podsRoot)) {
    fail(`Pods directory not found at ${podsRoot}\n       Run "npx pod-install" (or "cd ios && pod install") first.`);
  }

  const targets = discoverTargets(podsRoot).map((target) => ({ ...target, podsRoot }));
  if (targets.length === 0) {
    fail(`No precompiled pods with debug/release tarballs found under ${podsRoot}. Nothing to sync.`);
  }

  console.log(`\n${COLORS.bold}Pods:${COLORS.reset}   ${podsRoot}`);
  console.log(`${COLORS.bold}Target:${COLORS.reset} ${opts.config}${opts.dryRun ? ` ${COLORS.dim}(dry run)${COLORS.reset}` : ''}\n`);

  // Resolve the real tarball member path once per pod (it can differ from the on-disk layout).
  for (const target of targets) {
    target.deviceSuffixInDebug = resolveTarMember(target.debugTarball, target.deviceSuffix);
    target.deviceSuffixInRelease = resolveTarMember(target.releaseTarball, target.deviceSuffix);
  }

  const width = Math.max(...targets.map((target) => target.name.length), 10);
  let mismatched = 0;

  for (const target of targets) {
    const before = detectInstalledFlavor(target);
    let flavor = before.flavor;
    let note = '';

    const needsSwap = opts.force || flavor !== opts.config;

    if (needsSwap && !opts.dryRun) {
      const result = forceSwap(target, opts.config);
      if (!result.ok) {
        note = `  ${COLORS.red}swap failed: ${result.message}${COLORS.reset}`;
      }
      flavor = detectInstalledFlavor(target).flavor;
    }

    if (flavor !== opts.config) mismatched++;

    const label = flavor.padEnd(9);
    const action = !needsSwap
      ? `${COLORS.dim}already correct${COLORS.reset}`
      : opts.dryRun
        ? `${COLORS.yellow}needs sync${COLORS.reset}`
        : `${COLORS.dim}synced${COLORS.reset}`;

    console.log(
      `  ${target.name.padEnd(width)}  ${colorFor(flavor, opts.config)}${label}${COLORS.reset}` +
        `  ${COLORS.dim}(${before.binaries.length} slice${before.binaries.length === 1 ? '' : 's'})${COLORS.reset}  ${action}${note}`,
    );
  }

  console.log('');

  if (mismatched > 0 && !opts.dryRun) {
    console.log(
      `${COLORS.red}${mismatched} pod${mismatched === 1 ? '' : 's'} still on the wrong flavor.${COLORS.reset} ` +
        `Try \`--force\`, or wipe Pods and re-run the build.\n`,
    );
    process.exit(1);
  }

  if (opts.dryRun && mismatched > 0) {
    console.log(`${COLORS.yellow}${mismatched} pod${mismatched === 1 ? '' : 's'} would be synced to ${opts.config}.${COLORS.reset} Re-run without --dry-run.\n`);
    process.exit(1);
  }

  console.log(`${COLORS.green}All ${targets.length} precompiled pods are on the "${opts.config}" flavor.${COLORS.reset}\n`);
}

main();
