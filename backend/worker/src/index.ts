// The queue connection is added with the document pipeline in Phase 2.
// Keeping a separate process now makes its deployment boundary explicit.
console.info(
  JSON.stringify({
    level: "info",
    message: "Worker scaffold ready; no queues are registered in Phase 0",
  }),
);
