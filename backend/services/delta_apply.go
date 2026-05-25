package services

import "sort"

func applyBufferDelta(base string, delta *BufferDelta) string {
	if delta == nil || len(delta.Ops) == 0 {
		return base
	}

	insertions := make(map[int][]string)
	type deleteRange struct {
		from int
		to   int
	}
	deletes := make([]deleteRange, 0)

	for _, op := range delta.Ops {
		switch op.Type {
		case "insert":
			pos := clamp(op.Pos, 0, len(base))
			insertions[pos] = append(insertions[pos], op.Text)
		case "delete":
			from := clamp(op.From, 0, len(base))
			to := clamp(op.To, 0, len(base))
			if to <= from {
				continue
			}
			deletes = append(deletes, deleteRange{from: from, to: to})
		}
	}

	if len(deletes) == 0 && len(insertions) == 0 {
		return base
	}

	sort.Slice(deletes, func(i, j int) bool {
		if deletes[i].from == deletes[j].from {
			return deletes[i].to < deletes[j].to
		}
		return deletes[i].from < deletes[j].from
	})

	mergedDeletes := make([]deleteRange, 0, len(deletes))
	for _, current := range deletes {
		if len(mergedDeletes) == 0 {
			mergedDeletes = append(mergedDeletes, current)
			continue
		}
		last := &mergedDeletes[len(mergedDeletes)-1]
		if current.from <= last.to {
			if current.to > last.to {
				last.to = current.to
			}
			continue
		}
		mergedDeletes = append(mergedDeletes, current)
	}

	out := make([]byte, 0, len(base)+64)
	deleteIdx := 0

	for i := 0; i <= len(base); i++ {
		if inserts, ok := insertions[i]; ok {
			for _, text := range inserts {
				out = append(out, text...)
			}
		}

		if i == len(base) {
			break
		}

		for deleteIdx < len(mergedDeletes) && i >= mergedDeletes[deleteIdx].to {
			deleteIdx++
		}
		if deleteIdx < len(mergedDeletes) {
			r := mergedDeletes[deleteIdx]
			if i >= r.from && i < r.to {
				continue
			}
		}

		out = append(out, base[i])
	}

	return string(out)
}

func clamp(v, min, max int) int {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}
