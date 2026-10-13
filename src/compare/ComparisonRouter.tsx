import ComparisonIndexPage from "./ComparisonIndexPage";
import ComparisonMethodPage from "./ComparisonMethodPage";
import { getMethod } from "./registry";

export function compareMethodIdFromHash(hash: string): string | null {
  const path = hash.replace(/^#\/compare\/?/, "");
  return path ? decodeURIComponent(path.split("/")[0]) : null;
}

function ComparisonRouter({ hash }: { hash: string }) {
  const methodId = compareMethodIdFromHash(hash);
  const method = methodId ? getMethod(methodId) : undefined;

  return method ? <ComparisonMethodPage method={method} /> : <ComparisonIndexPage />;
}

export default ComparisonRouter;
