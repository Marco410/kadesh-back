import { hasRole } from "../../auth/permissions";
import { Role } from "../Role/constants";

const access = {
  operation: {
    query: ({ session }: any) => hasRole(session, [Role.USER]),
    create: ({ session }: any) => hasRole(session, [Role.USER]),
    update: ({ session }: any) => hasRole(session, [Role.USER]),
    delete: ({ session }: any) => hasRole(session, [Role.USER]),
  },
  filter: {
    query: ({ session }: any) => hasRole(session, [Role.USER]),
    update: ({ session }: any) => hasRole(session, [Role.USER]),
    delete: ({ session }: any) => hasRole(session, [Role.USER]),
  },
  item: {
    create: ({ session }: any) => hasRole(session, [Role.USER]),
    update: ({ session }: any) => hasRole(session, [Role.USER]),
    delete: ({ session }: any) => hasRole(session, [Role.USER]),
  },
};

export default access;
