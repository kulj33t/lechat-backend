const getId = (value) => value?._id ?? value;

export const sameId = (left, right) => {
  const leftId = getId(left);
  const rightId = getId(right);
  return leftId != null && rightId != null && String(leftId) === String(rightId);
};

export const includesId = (values, id) =>
  Array.isArray(values) && values.some((value) => sameId(value, id));
