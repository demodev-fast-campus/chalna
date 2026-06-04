import { useLocation } from "wouter";
import { Camera, Grid3X3 } from "lucide-react";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [location, navigate] = useLocation();

  // Pages that show the bottom tab bar
  const showTabBar = !location.startsWith("/camera");

  const isCamera = location.startsWith("/camera");
  const isLog = location === "/" || location.startsWith("/room") || location.startsWith("/create") || location.startsWith("/join");

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Main content area */}
      <div
        className="flex-1 overflow-hidden"
        style={{ paddingBottom: showTabBar ? "64px" : "0" }}
      >
        {children}
      </div>

      {/* Bottom Tab Bar */}
      {showTabBar && (
        <div
          className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] z-50 tab-bar"
          style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(16px)", borderTop: "1px solid #1a1a1a" }}
        >
          <div className="flex items-center justify-around h-16">
            {/* 로그 탭 */}
            <button
              className="flex flex-col items-center gap-1 flex-1 py-2 transition-all duration-150"
              onClick={() => navigate("/")}
            >
              <Grid3X3
                size={22}
                className={isLog ? "text-[#11E6D4]" : "text-[#555]"}
                strokeWidth={isLog ? 2.2 : 1.8}
              />
              <span
                className="text-[11px] font-medium"
                style={{ color: isLog ? "#11E6D4" : "#555" }}
              >
                로그
              </span>
            </button>

            {/* 카메라 탭 */}
            <button
              className="flex flex-col items-center gap-1 flex-1 py-2 transition-all duration-150"
              onClick={() => navigate("/camera")}
            >
              <Camera
                size={22}
                className={isCamera ? "text-[#11E6D4]" : "text-[#555]"}
                strokeWidth={isCamera ? 2.2 : 1.8}
              />
              <span
                className="text-[11px] font-medium"
                style={{ color: isCamera ? "#11E6D4" : "#555" }}
              >
                카메라
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
