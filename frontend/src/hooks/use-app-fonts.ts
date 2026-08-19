import { useFonts } from "expo-font";

const FS = "https://cdn.jsdelivr.net/npm/@fontsource/nunito@5.0.13/files";

export const useAppFonts = () =>
  useFonts({
    Nunito_400Regular: `${FS}/nunito-latin-400-normal.ttf`,
    Nunito_600SemiBold: `${FS}/nunito-latin-600-normal.ttf`,
    Nunito_700Bold: `${FS}/nunito-latin-700-normal.ttf`,
    Nunito_800ExtraBold: `${FS}/nunito-latin-800-normal.ttf`,
  });
