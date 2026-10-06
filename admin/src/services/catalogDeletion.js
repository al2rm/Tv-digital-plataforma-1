export async function deleteChannelSelection(ids, request, onProgress = () => {}) {
  const selected = [...new Set(ids)];
  let deleted = 0;
  let missing = 0;
  for (let offset = 0; offset < selected.length; offset += 500) {
    const batch = selected.slice(offset, offset + 500);
    try {
      const response = await request(batch);
      deleted += response.data.data.deleted.length;
      missing += response.data.data.missing || 0;
    } catch (error) {
      // A stale selection can contain channels already removed by another admin.
      if (error.response?.status !== 404) throw error;
      missing += batch.length;
    }
    onProgress({ deleted, missing, processed: Math.min(offset + batch.length, selected.length), total: selected.length });
  }
  return { deleted, missing };
}
