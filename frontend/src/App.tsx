import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import { Layout, RequireAuth } from "@/components/Layout";
import { PageSkeleton } from "@/components/States";
import BrowsePage from "@/pages/BrowsePage";
import HomePage from "@/pages/HomePage";
import ItemPage from "@/pages/ItemPage";
import NotFoundPage from "@/pages/NotFoundPage";

// Less-visited pages are split into their own chunks to keep the first load small on school Wi-Fi.
const ReportPage = lazy(() => import("@/pages/ReportPage"));
const MyItemsPage = lazy(() => import("@/pages/MyItemsPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const AdminPage = lazy(() => import("@/pages/admin/AdminPage"));
const QuickAddPage = lazy(() => import("@/pages/QuickAddPage"));
const AboutPage = lazy(() => import("@/pages/AboutPage"));

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageSkeleton />}>{children}</Suspense>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="browse" element={<BrowsePage />} />
          <Route path="items/:id" element={<ItemPage />} />
          <Route
            path="report/lost"
            element={
              <RequireAuth>
                <Lazy>
                  <ReportPage key="lost" kind="lost" />
                </Lazy>
              </RequireAuth>
            }
          />
          <Route
            path="report/found"
            element={
              <RequireAuth>
                <Lazy>
                  <ReportPage key="found" kind="found" />
                </Lazy>
              </RequireAuth>
            }
          />
          <Route
            path="me"
            element={
              <RequireAuth>
                <Lazy>
                  <MyItemsPage />
                </Lazy>
              </RequireAuth>
            }
          />
          <Route
            path="login"
            element={
              <Lazy>
                <LoginPage />
              </Lazy>
            }
          />
          <Route
            path="admin"
            element={
              <RequireAuth admin>
                <Lazy>
                  <AdminPage />
                </Lazy>
              </RequireAuth>
            }
          />
          <Route
            path="admin/quick-add"
            element={
              <RequireAuth admin>
                <Lazy>
                  <QuickAddPage />
                </Lazy>
              </RequireAuth>
            }
          />
          <Route
            path="about"
            element={
              <Lazy>
                <AboutPage />
              </Lazy>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
