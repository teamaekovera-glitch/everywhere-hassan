/**
 * Minimal binary min-heap. Pop order is fully determined by the comparator —
 * and every call site passes a deterministic one — so runs over identical
 * inputs expand labels in identical order.
 */
export class MinHeap<T> {
  private items: T[] = []

  constructor(private readonly less: (a: T, b: T) => number) {}

  get size(): number {
    return this.items.length
  }

  push(item: T): void {
    this.items.push(item)
    let i = this.items.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.less(this.items[i]!, this.items[parent]!) >= 0) break
      ;[this.items[i], this.items[parent]] = [this.items[parent], this.items[i]]
      i = parent
    }
  }

  pop(): T | undefined {
    const top = this.items[0]
    const last = this.items.pop()
    if (this.items.length > 0 && last !== undefined) {
      this.items[0] = last
      let i = 0
      for (;;) {
        const left = 2 * i + 1
        const right = left + 1
        let smallest = i
        if (left < this.items.length && this.less(this.items[left]!, this.items[smallest]!) < 0) {
          smallest = left
        }
        if (right < this.items.length && this.less(this.items[right]!, this.items[smallest]!) < 0) {
          smallest = right
        }
        if (smallest === i) break
        ;[this.items[i], this.items[smallest]] = [this.items[smallest], this.items[i]]
        i = smallest
      }
    }
    return top
  }
}
