import { readDocs } from '@/lib/read-docs'
import DocsViewer from '@/components/dashboard/DocsViewer'

export default function DocsPage() {
  const sections = readDocs('koja2')
  return <DocsViewer sections={sections} />
}
