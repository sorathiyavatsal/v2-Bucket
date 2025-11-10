#!/usr/bin/env node

/**
 * Cross-platform script to kill process on a specific port
 * Works on Windows, macOS, and Linux
 */

const { exec } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function killPort(port) {
  const platform = process.platform;

  console.log(`Attempting to kill process on port ${port}...`);

  if (platform === 'win32') {
    // Windows
    exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
      if (error) {
        console.log(`No process found on port ${port}`);
        rl.close();
        return;
      }

      const lines = stdout.trim().split('\n');
      const pids = new Set();

      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0') {
          pids.add(pid);
        }
      });

      if (pids.size === 0) {
        console.log(`No process found on port ${port}`);
        rl.close();
        return;
      }

      pids.forEach(pid => {
        exec(`taskkill /F /PID ${pid}`, (killError, killStdout) => {
          if (killError) {
            console.error(`Failed to kill process ${pid}:`, killError.message);
          } else {
            console.log(`✓ Successfully killed process ${pid} on port ${port}`);
          }
        });
      });

      setTimeout(() => rl.close(), 1000);
    });
  } else {
    // macOS and Linux
    exec(`lsof -ti:${port}`, (error, stdout) => {
      if (error) {
        console.log(`No process found on port ${port}`);
        rl.close();
        return;
      }

      const pids = stdout.trim().split('\n').filter(Boolean);

      if (pids.length === 0) {
        console.log(`No process found on port ${port}`);
        rl.close();
        return;
      }

      pids.forEach(pid => {
        exec(`kill -9 ${pid}`, (killError) => {
          if (killError) {
            console.error(`Failed to kill process ${pid}:`, killError.message);
          } else {
            console.log(`✓ Successfully killed process ${pid} on port ${port}`);
          }
        });
      });

      setTimeout(() => rl.close(), 1000);
    });
  }
}

// Main execution
console.log('Cross-Platform Port Killer');
console.log('=========================\n');

rl.question('Enter port number to kill: ', (answer) => {
  const port = parseInt(answer.trim(), 10);

  if (isNaN(port) || port < 1 || port > 65535) {
    console.error('Invalid port number. Please enter a number between 1 and 65535.');
    rl.close();
    return;
  }

  killPort(port);
});

// Handle Ctrl+C
rl.on('SIGINT', () => {
  console.log('\nOperation cancelled.');
  rl.close();
});
