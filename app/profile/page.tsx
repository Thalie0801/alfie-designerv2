import { requireUserWithProfile } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProfilePage() {
  const { user, profile } = await requireUserWithProfile("/profile");

  return (
    <div className="container">
      <div className="card profile-card">
        <h1>Profil</h1>
        <dl>
          <div className="row">
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div className="row">
            <dt>Plan</dt>
            <dd>{profile?.plan ?? "à configurer"}</dd>
          </div>
        </dl>
      </div>

      <style jsx>{`
        .profile-card {
          display: grid;
          gap: 16px;
        }

        dl {
          display: grid;
          gap: 12px;
        }

        .row {
          display: flex;
          gap: 16px;
          justify-content: space-between;
        }

        dt {
          font-weight: 600;
        }

        dd {
          margin: 0;
        }
      `}</style>
    </div>
  );
}
