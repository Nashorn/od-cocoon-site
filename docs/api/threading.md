# Threading

> Reference draft: present in the inspected local source and site runtime. Availability in the public installation release has not yet been established.

`core.lang.Thread` runs a serialized function in a Web Worker. `core.lang.ThreadPool` queues jobs across a fixed collection of these workers.

## Example: summarize sales away from the page thread

A dashboard can aggregate imported sales records in a worker while the page handles input. This example partitions records between two workers and combines their subtotals. Run it in an application after Cocoon has loaded:

```javascript
const orders = [
  { category: 'Coffee', amount: 12 },
  { category: 'Tea', amount: 8 },
  { category: 'Coffee', amount: 18 },
  { category: 'Tea', amount: 10 },
];
const pool = new core.lang.ThreadPool(records => {
  const totals = new Map();
  for (const { category, amount } of records) {
    totals.set(category, (totals.get(category) || 0) + amount);
  }
  return [...totals];
}, 2);

try {
  const midpoint = Math.ceil(orders.length / 2);
  const batches = [orders.slice(0, midpoint), orders.slice(midpoint)];
  const subtotals = await Promise.all(batches.map(batch => pool.run(batch)));
  const totals = new Map();
  for (const batch of subtotals) {
    for (const [category, amount] of batch) {
      totals.set(category, (totals.get(category) || 0) + amount);
    }
  }
  console.log(Object.fromEntries(totals)); // { Coffee: 30, Tea: 18 }
} finally {
  pool.terminate();
}
```

The four records make the result easy to check. Workers are worthwhile for substantial computation, not because four additions need parallelism: startup and data copying cost time too. Parsing a large file on the main thread is still main-thread work; moving aggregation alone does not move the file parser.

The worker receives each batch as data, uses no closure variables, and returns category totals. `Promise.all()` waits for both jobs; `finally` releases the workers even if a job fails. Validate real imported records before using them, and use integer minor units when exact currency arithmetic is required.

## ThreadPool API

| Member | Contract |
| --- | --- |
| `new core.lang.ThreadPool(fn, size)` | Create workers from the serialized function. Supply a positive integer size. The constructor does not validate this argument. |
| `ThreadPool.defaultSize()` | `Math.max(1, (navigator.hardwareConcurrency || 2) - 1)`. |
| `pool.size` | Current worker count; becomes zero after termination. |
| `pool.run(data, transfer = [])` | Return a promise for a queued job's result. Queued jobs are dispatched in enqueue order as workers become available; completion order can differ. |
| `pool.terminate()` | Terminate workers and reject active and queued jobs. Later `run()` calls reject with `ThreadPool terminated`. |

## Worker boundaries

The function must be self-contained. It cannot capture variables from its surrounding application scope or use page DOM APIs. Data crosses the worker boundary using structured cloning, with optional transferables.

```javascript
const pool = new core.lang.ThreadPool(buffer => {
  const values = new Float32Array(buffer);
  for (let i = 0; i < values.length; i++) values[i] *= 2;
  return self.transfer(values.buffer, [values.buffer]);
}, 2);

try {
  const values = new Float32Array([1, 2, 3]);
  const result = await pool.run(values.buffer, [values.buffer]);
  // values.buffer has been transferred; use the returned buffer.
  console.log([...new Float32Array(result)]); // [2, 4, 6]
} finally {
  pool.terminate();
}
```

`self.transfer(result, list)` is installed by Cocoon inside the worker. It marks a return value for transfer back to the caller.

## Individual Thread

`new core.lang.Thread(fn)` provides `run(data, transfer = [])` and `terminate()` for one worker. `run()` tracks responses with job IDs and rejects on a worker-reported job error. Multiple direct `run()` calls are not the pool's one-job-per-worker scheduling contract.

The implementation also has `postMessage()`, `onmessage`, and `onerror` for raw messaging. Mixing raw messages with managed jobs requires care; the first guide will use the promise-based `run()` interface.

There is no per-job cancellation method in the inspected public surface. Termination acts on the whole thread or pool. Release workers when their owning application or component no longer needs them.

## Choosing a worker function

The runtime serializes the supplied function into a Blob worker. Use a standalone function or arrow expression whose source is a valid function expression. A bound function or method shorthand's string representation is not necessarily suitable.

All dependencies must be inside the function or explicitly available in that worker. The page's import map, namespace globals, DOM nodes, and closure variables are not automatically copied into it. The worker function is called with the worker global as its receiver for ordinary functions; arrow functions retain their own lexical receiver behavior. `self` is an explicit worker-global reference.

The worker awaits a returned promise for managed `run()` jobs. It catches job exceptions and replies with an error message and stack; the caller receives a reconstructed Error rather than the original custom error instance and all of its properties.

## Stateful workers and scheduling

A Thread persists across jobs. State deliberately stored on its worker global survives until termination:

```javascript
const pool = new core.lang.ThreadPool(value => {
  self.jobCount = (self.jobCount || 0) + 1;
  return { value: value * 2, jobCount: self.jobCount };
}, 1);
```

Use try/finally to terminate the pool when done. With multiple workers, each worker has its own state; there is no promise that related jobs use the same worker. Stateless jobs are easier to distribute predictably.

The pool starts at most one managed job per worker, releasing that worker after the job promise settles. A caught job error rejects that job and permits subsequent queued work. Thread.run used directly does not impose this queue: asynchronous jobs may overlap inside the same worker and reply out of order; job IDs associate replies with the correct caller promises.

Promise.all preserves the order of the submitted promises in its result array; that does not mean workers finish in that order.

## Queued data and ownership

ThreadPool.run stores the data reference in its queue. Structured cloning/transfer occurs when a worker is available and Thread.run posts the job, not necessarily when the pool call first returns.

Consequences:

- Mutating an object while its job is queued can change what the worker receives.
- A queued transferable buffer is not necessarily detached immediately; it detaches when posted.
- Treat submitted inputs as owned by the job until completion rather than relying on immediate cloning/detachment.
- A function or DOM node is not ordinary structured-cloneable input. Posting unsupported values rejects rather than making page capabilities available inside the worker.

Transfers avoid copying the transferred buffer ownership; they do not make it simultaneously usable by both owners. Return transferable results with worker-side self.transfer as shown above.

## Errors, cancellation, and recovery

| Situation | Current behavior |
| --- | --- |
| Function throws/rejects in managed job | Reject that job with reconstructed message/stack; a pool worker can accept another job. |
| Worker error/message-error event | Thread rejects its pending jobs and calls its onerror handler if set. |
| Serialization/postMessage failure | The run promise rejects; the implementation's pending-job bookkeeping can remain until later cleanup. |
| Active worker terminated | Pending managed Thread jobs reject with Thread terminated. |
| Jobs still queued when pool terminates | Reject with ThreadPool terminated. |
| run after termination | Reject; workers are not silently recreated. |

There is no automatic timeout, per-job abort signal, backpressure limit, or transparent crashed-worker replacement in this implementation. A never-settling job can hold a pool worker indefinitely. Application-owned timeout handling must also decide whether to terminate the affected thread/pool; Promise.race alone does not stop computation.

Termination is destructive to all jobs on that worker/pool. It is not a pause/resume operation. Component removal or stopping a World's animation loop does not implicitly terminate your pool; its owner must do so.

## Raw messaging is a different contract

With `thread.postMessage(message, transfer)`, a non-managed message invokes the worker function with the MessageEvent rather than the managed job's data value. A raw function must explicitly call self.postMessage to send a reply; returning a value is not automatically converted into a managed response.

```javascript
const thread = new core.lang.Thread(function (event) {
  self.postMessage(event.data * 2);
});
thread.onmessage = event => console.log(event.data);
thread.postMessage(4);
// Terminate when the owning operation is complete.
```

Avoid mixing raw and managed traffic casually: the internal managed envelope uses a reserved field, and the function receives different input shapes. Prefer run for request/result work and document any intentional streaming protocol separately.
