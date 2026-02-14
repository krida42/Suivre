import { useNavigate } from "react-router-dom";
import { MyCreatorsPage } from "@pages/MyCreatorsPage";
import type { ContentCreator } from "@models/creators";

export const MyCreatorsRouteWrapper = () => {
  const navigate = useNavigate();
  console.log("Helloooo")

  const goToCreator = (creator: ContentCreator) => {
    navigate(`/app/creator/${creator.id}`, { state: { creator } });
  };

  return <MyCreatorsPage goToCreator={goToCreator} />;
};
