import type { Dispatch, SetStateAction } from "react";
import { Route, Routes } from "react-router-dom";
import { HomePage } from "@pages/HomePage";
import { CreateCreatorPage } from "@pages/CreateCreatorPage";
import { AccountPage } from "@pages/AccountPage";
import { CreatorRouteWrapper } from "@router/CreatorRouteWrapper";
import { ContentRouteWrapper } from "@router/ContentRouteWrapper";
import { PublishRouteWrapper } from "@router/PublishRouteWrapper";
import { VideoRouteWrapper } from "@router/VideoRouteWrapper";
import type { ContentCreator } from "@models/creators";
import type { User } from "@models/domain";
import { MyCreatorsRouteWrapper } from "./MyCreatorsRouteWrapper";

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
      <Route path="my-creators" element={<MyCreatorsRouteWrapper />} />
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
