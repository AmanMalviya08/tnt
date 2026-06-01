const sanitize = (text = "") =>
  text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const generateSlug = (text = "") => sanitize(text);

const ensureUniqueSlug = async (model, slug, excludeId, field = "slug") => {
  if (!slug) {
    return slug;
  }

  let uniqueSlug = slug;
  let counter = 1;
  const baseSlug = slug;
  const query = { [field]: uniqueSlug };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  // eslint-disable-next-line no-constant-condition
  while (await model.exists(query)) {
    uniqueSlug = `${baseSlug}-${counter++}`;
    query[field] = uniqueSlug;
  }

  return uniqueSlug;
};

module.exports = {
  generateSlug,
  ensureUniqueSlug,
};
