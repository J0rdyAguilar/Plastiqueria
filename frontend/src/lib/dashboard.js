import { http } from "./http";

function cleanParams(obj = {}) {
  const params = new URLSearchParams();

  Object.entries(obj).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    const text = String(value).trim();
    if (text === "") return;

    params.set(key, text);
  });

  return params.toString();
}

export const dashboardApi = {
  resumen: async ({ ubicacion_id = "" } = {}) => {
    const query = cleanParams({ ubicacion_id });
    const url = query ? `/dashboard/resumen?${query}` : `/dashboard/resumen`;
    const { data } = await http.get(url);
    return data;
  },
};