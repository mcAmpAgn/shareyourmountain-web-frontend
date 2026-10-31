import type { ReactNode } from 'react';
import '../record-labels.css';
export type RecordTone = 'mountain' | 'route' | 'range' | 'section' | 'subsection' | 'group';
export function RecordLabel({ tone, children }: { tone: RecordTone; children: ReactNode }) {
  return (
    <span className="record-label" data-record-tone={tone}>
      {children}
    </span>
  );
}
