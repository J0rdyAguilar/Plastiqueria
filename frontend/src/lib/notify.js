import toast from "react-hot-toast";

function getMessage(error, fallback = "Ocurrió un error") {
  return (
    error?.response?.data?.message ||
    error?.data?.message ||
    error?.message ||
    fallback
  );
}

export const notify = {
  success(msg) {
    toast.success(msg);
  },

  error(err, fallback) {
    toast.error(typeof err === "string" ? err : getMessage(err, fallback));
  },

  loading(msg = "Procesando...") {
    return toast.loading(msg);
  },

  dismiss(id) {
    toast.dismiss(id);
  },

  promise(promise, messages = {}) {
    return toast.promise(promise, {
      loading: messages.loading || "Procesando...",
      success: messages.success || "Listo",
      error: (err) =>
        messages.error || getMessage(err, "Error inesperado"),
    });
  },
};