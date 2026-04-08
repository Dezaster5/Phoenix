import { Navigate, useLocation } from "react-router-dom";

export default function ProtectedRoute({
  isAuthenticated = true,
  isAllowed = true,
  redirectTo = "/login",
  children
}) {
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  if (!isAllowed) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}
