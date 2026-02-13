import type { Dispatch, SetStateAction } from "react";
import { Route, Routes } from "react-router-dom";
import { HomePage } from "@features/discovery/pages/HomePage";
import { CreateCreatorPage } from "@features/creators/pages/CreateCreatorPage";
import { AccountPage } from "@features/account/pages/AccountPage";
import { CreatorRouteWrapper } from "@app/router/wrappers/CreatorRouteWrapper";
import { ContentRouteWrapper } from "@app/router/wrappers/ContentRouteWrapper";
import { PublishRouteWrapper } from "@app/router/wrappers/PublishRouteWrapper";
import { VideoRouteWrapper } from "@app/router/wrappers/VideoRouteWrapper";
import type { ContentCreator } from "@features/creators/types";
import type { User } from "@shared/types/domain";

interface AppRoutesProps {
  currentUser: User | null;
  setCurrentUser: Dispatch<SetStateAction<User | null>>;
  goHome: () => void;
  goToCreator: (arg: ContentCreator | string) => void;
  isSubscribedGlobal: boolean;
}

export function AppRoutes({ currentUser, setCurrentUser, goHome, goToCreator, isSubscribedGlobal }: AppRoutesProps) {
  return (
    <Routes>
      <Route index element={<HomePage goToCreator={(creator) => goToCreator(creator)} />} />
      <Route path="creator/:id" element={<CreatorRouteWrapper />} />
      <Route
        path="video/:id"
        element={
          <VideoRouteWrapper
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
            goHome={goHome}
            goToCreator={goToCreator}
          />
        }
      />
      <Route path="content/:id" element={<ContentRouteWrapper />} />
      <Route path="publish" element={<PublishRouteWrapper />} />
      <Route path="create-profile" element={<CreateCreatorPage />} />
      <Route path="account" element={<AccountPage currentUser={currentUser} isSubscribed={isSubscribedGlobal} />} />
    </Routes>
  );
}
