import { useEffect } from 'react';

const SUFFIX = 'Hanwella Spareparts WMS';

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${SUFFIX}` : SUFFIX;
  }, [title]);
}
