export const TARGET_CODE = `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10));
console.log('Done!');`

export const MATCH_TOAST_DURATION_MS = 1500
