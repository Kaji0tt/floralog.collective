import { Query } from "@/api/entities";
import { createUserNotification, getUserDisplayName } from "@/api/notificationService";

const toLower = (value) => String(value || "").trim().toLowerCase();

const uniqueById = (entries = []) => {
  const map = new Map();
  entries.forEach((entry) => {
    if (!entry?.id) return;
    if (!map.has(entry.id)) {
      map.set(entry.id, entry);
    }
  });
  return Array.from(map.values());
};

export function buildCollectionMembershipIndex({
  plants = [],
  collectionItems = [],
  collections = [],
  genera = [],
  userPendingProposals = [],
}) {
  const collectionById = new Map((collections || []).map((collection) => [collection.id, collection]));
  const genusIdByKey = new Map(
    (genera || []).map((genus) => [`${genus.category}::${genus.category_dex_number}`, genus.id])
  );

  const plantIdsByGenusId = new Map();
  (plants || []).forEach((plant) => {
    const genusId = genusIdByKey.get(`${plant.genus_category}::${plant.genus_number}`);
    if (!genusId) return;
    if (!plantIdsByGenusId.has(genusId)) {
      plantIdsByGenusId.set(genusId, []);
    }
    plantIdsByGenusId.get(genusId).push(plant.id);
  });

  const membershipsByPlantId = {};

  (collectionItems || []).forEach((item) => {
    if (!item?.collection_id) return;
    const collection = collectionById.get(item.collection_id);
    if (!collection) return;

    const entry = {
      id: collection.id,
      title: collection.title || "Kollektion",
      is_public: !!collection.is_public,
      private_maintained: !!collection.private_maintained,
    };

    if (item.plant_id) {
      membershipsByPlantId[item.plant_id] = uniqueById([...(membershipsByPlantId[item.plant_id] || []), entry]);
      return;
    }

    if (item.genus_id) {
      const plantIds = plantIdsByGenusId.get(item.genus_id) || [];
      plantIds.forEach((plantId) => {
        membershipsByPlantId[plantId] = uniqueById([...(membershipsByPlantId[plantId] || []), entry]);
      });
    }
  });

  Object.keys(membershipsByPlantId).forEach((plantId) => {
    membershipsByPlantId[plantId] = [...(membershipsByPlantId[plantId] || [])].sort((a, b) =>
      (a.title || "").localeCompare(b.title || "", "de")
    );
  });

  const pendingCollectionIdsByPlantId = {};

  (userPendingProposals || [])
    .filter((proposal) => proposal?.status === "pending")
    .forEach((proposal) => {
      const pushPending = (plantId) => {
        if (!plantId) return;
        const current = new Set(pendingCollectionIdsByPlantId[plantId] || []);
        current.add(proposal.collection_id);
        pendingCollectionIdsByPlantId[plantId] = Array.from(current);
      };

      if (proposal.plant_id) {
        pushPending(proposal.plant_id);
        return;
      }

      if (proposal.genus_id) {
        const plantIds = plantIdsByGenusId.get(proposal.genus_id) || [];
        plantIds.forEach(pushPending);
      }
    });

  return {
    membershipsByPlantId,
    pendingCollectionIdsByPlantId,
  };
}

async function getCollectionManagementContext(collectionId) {
  const [collections, maintainers, profiles] = await Promise.all([
    Query.Collection.filter({ id: collectionId }),
    Query.CollectionMaintainer.filter({ collection_id: collectionId }),
    Query.PublicProfile.list(),
  ]);

  const collection = (collections || [])[0] || null;
  const managerAuthIds = new Set((maintainers || []).map((entry) => entry.auth_id).filter(Boolean));
  if (collection?.auth_id) {
    managerAuthIds.add(collection.auth_id);
  }

  const profileByAuthId = new Map((profiles || []).map((profile) => [profile.auth_id, profile]));

  return {
    collection,
    managerAuthIds,
    profileByAuthId,
  };
}

export async function submitCollectionItemProposal({
  collectionId,
  plant,
  genusId,
  actorUser,
  note,
}) {
  if (!collectionId) throw new Error("collectionId fehlt.");
  if (!actorUser?.id) throw new Error("Benutzer nicht angemeldet.");

  const proposal = await Query.CollectionItemProposal.create({
    collection_id: collectionId,
    plant_id: plant?.id || null,
    genus_id: genusId || null,
    note: note?.trim() || null,
    proposed_by_auth_id: actorUser.id,
    status: "pending",
  });

  const { collection, managerAuthIds, profileByAuthId } = await getCollectionManagementContext(collectionId);
  const actorName = getUserDisplayName(actorUser, actorUser?.email || "Jemand");
  const plantLabel = plant?.species_name || plant?.scientific_name || "eine Pflanze";

  const notifications = Array.from(managerAuthIds)
    .filter((authId) => authId && authId !== actorUser.id)
    .map((authId) => {
      const profile = profileByAuthId.get(authId);
      return createUserNotification({
        authId,
        userEmail: profile?.user_email,
        notificationType: "collection_item_proposed",
        title: "🌿 Neuer Kollektion-Vorschlag",
        message: `${actorName} hat ${plantLabel} fuer ${collection?.title || "deine Kollektion"} vorgeschlagen.`,
        actionUrl: `CollectionEditor?id=${collectionId}`,
        description: note?.trim() || "",
        createdBy: actorUser?.email || "system",
      });
    });

  await Promise.allSettled(notifications);
  return proposal;
}

export async function reviewCollectionItemProposal({
  proposalId,
  status,
  reviewNote,
  actorUser,
}) {
  if (!proposalId) throw new Error("proposalId fehlt.");
  if (!actorUser?.id) throw new Error("Benutzer nicht angemeldet.");
  if (!["approved", "rejected"].includes(status)) {
    throw new Error("Ungueltiger Status.");
  }

  const proposals = await Query.CollectionItemProposal.filter({ id: proposalId });
  const proposal = (proposals || [])[0] || null;
  if (!proposal) throw new Error("Vorschlag nicht gefunden.");

  const updatedProposal = await Query.CollectionItemProposal.update(proposalId, {
    status,
    review_note: reviewNote?.trim() || null,
    decision_by_auth_id: actorUser.id,
    decision_date: new Date().toISOString(),
  });

  if (proposal.proposed_by_auth_id && proposal.proposed_by_auth_id !== actorUser.id) {
    const [profiles, collections, plants] = await Promise.all([
      Query.PublicProfile.list(),
      Query.Collection.filter({ id: proposal.collection_id }),
      proposal.plant_id ? Query.Plant.filter({ id: proposal.plant_id }) : Promise.resolve([]),
    ]);

    const proposerProfile = (profiles || []).find((profile) => profile.auth_id === proposal.proposed_by_auth_id);
    const collection = (collections || [])[0] || null;
    const proposalPlant = (plants || [])[0] || null;
    const actorName = getUserDisplayName(actorUser, actorUser?.email || "Jemand");
    const plantLabel = proposalPlant?.species_name || proposalPlant?.scientific_name || "dein Pflanzeneintrag";
    const decisionLabel = status === "approved" ? "bestaetigt" : "abgelehnt";

    await createUserNotification({
      authId: proposal.proposed_by_auth_id,
      userEmail: proposerProfile?.user_email,
      notificationType: status === "approved" ? "collection_item_approved" : "collection_item_rejected",
      title: status === "approved" ? "✅ Vorschlag bestaetigt" : "⚠️ Vorschlag abgelehnt",
      message: `${actorName} hat ${plantLabel} fuer ${collection?.title || "die Kollektion"} ${decisionLabel}.`,
      actionUrl: `Collection?collectionId=${proposal.collection_id}`,
      description: reviewNote?.trim() || "",
      createdBy: actorUser?.email || "system",
    });
  }

  return updatedProposal;
}

export async function addCollectionMaintainerByEmail({
  collectionId,
  email,
  role = "admin",
  actorUser,
}) {
  if (!collectionId) throw new Error("collectionId fehlt.");
  if (!actorUser?.id) throw new Error("Benutzer nicht angemeldet.");

  const normalizedEmail = toLower(email);
  if (!normalizedEmail) throw new Error("Bitte eine gueltige E-Mail eingeben.");
  if (!["owner", "admin"].includes(role)) throw new Error("Ungueltige Rolle.");

  const profiles = await Query.PublicProfile.list();
  const targetProfile = (profiles || []).find((profile) => toLower(profile.user_email) === normalizedEmail);

  if (!targetProfile?.auth_id) {
    throw new Error("Kein Nutzerprofil mit dieser E-Mail gefunden.");
  }

  const existing = await Query.CollectionMaintainer.filter({
    collection_id: collectionId,
    auth_id: targetProfile.auth_id,
  });

  let maintainer = null;
  if ((existing || []).length > 0) {
    maintainer = await Query.CollectionMaintainer.update(existing[0].id, { role });
  } else {
    maintainer = await Query.CollectionMaintainer.create({
      collection_id: collectionId,
      auth_id: targetProfile.auth_id,
      role,
    });
  }

  const actorName = getUserDisplayName(actorUser, actorUser?.email || "Jemand");
  const collections = await Query.Collection.filter({ id: collectionId });
  const collection = (collections || [])[0] || null;

  if (targetProfile.auth_id !== actorUser.id) {
    await createUserNotification({
      authId: targetProfile.auth_id,
      userEmail: targetProfile.user_email,
      notificationType: "collection_manager_added",
      title: "🛠️ Kollektion-Rolle erhalten",
      message: `${actorName} hat dir die Rolle ${role === "owner" ? "Owner" : "Admin"} fuer ${collection?.title || "eine Kollektion"} gegeben.`,
      actionUrl: `Collection?collectionId=${collectionId}`,
      createdBy: actorUser?.email || "system",
    });
  }

  return maintainer;
}

export async function removeCollectionMaintainer(maintainerId) {
  if (!maintainerId) throw new Error("maintainerId fehlt.");
  await Query.CollectionMaintainer.delete(maintainerId);
}
