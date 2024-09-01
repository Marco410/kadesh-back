const hooks = {
  validateInput: async ({
    context,
    operation,
    resolvedData,
    addValidationError,
  }: any) => {
    if (operation === "create") {
      try {
        const userId = resolvedData?.user.connect.id;
        const tokenOld = await context.query.TokenNotification.findMany({
          where: {
            token: {
              equals: resolvedData?.token,
            },
            user: {
              id: {
                equals: userId,
              },
            },
          },
          query: "token",
        });

        if (tokenOld.length === 0) {
          return resolvedData;
        }
        addValidationError("Token exists");
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log("Token notification error:", e);
      }
    }
    return resolvedData;
  },
};

export default { hooks };
