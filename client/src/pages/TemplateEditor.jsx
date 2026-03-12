import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Draggable from "react-draggable";
import API, { toStorageUrl } from "../api/axios";
import Loader from "../components/Loader";

const defaultField = {
  field_name: "",
  x_position: 100,
  y_position: 100,
  font_size: 30,
  font_family: "Arial",
  font_color: "#000000",
};

const prettifyFieldName = (fieldName) =>
  String(fieldName || "")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()) || "Value";

const commonFieldPresets = [
  { x_pct: 0.35, y_pct: 0.38, font_size: 52 },
  { x_pct: 0.35, y_pct: 0.5, font_size: 34 },
  { x_pct: 0.35, y_pct: 0.58, font_size: 28 },
  { x_pct: 0.68, y_pct: 0.78, font_size: 24 },
];

const fontFamilyOptions = [
  "Arial",
  "Times New Roman",
  "Georgia",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Courier New",
];

const getNextFieldName = (items = []) => {
  const maxIndex = items.reduce((max, item) => {
    const match = String(item?.field_name || "")
      .trim()
      .match(/^field_(\d+)$/i);
    if (!match) return max;
    const num = Number(match[1]);
    return Number.isFinite(num) ? Math.max(max, num) : max;
  }, 0);
  return `field_${maxIndex + 1}`;
};

export default function TemplateEditor() {
  const { id } = useParams();

  const [template, setTemplate] = useState(null);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState("");
  const [testPreviewUrl, setTestPreviewUrl] = useState("");
  const [testData, setTestData] = useState({});
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 });
  const [previewScale, setPreviewScale] = useState(1);
  const [newField, setNewField] = useState(defaultField);
  const [placingFieldId, setPlacingFieldId] = useState(null);
  const [activeFieldId, setActiveFieldId] = useState(null);
  const previewContainerRef = useRef(null);
  const fieldNodeRefs = useRef(new Map());
  const qrNodeRef = useRef(null);

  const getFieldNodeRef = (fieldId) => {
    if (!fieldNodeRefs.current.has(fieldId)) {
      fieldNodeRefs.current.set(fieldId, { current: null });
    }

    return fieldNodeRefs.current.get(fieldId);
  };

  const fetchTemplate = async () => {
    const [tplRes, fieldsRes] = await Promise.all([
      API.get(`/templates/${id}`),
      API.get(`/templates/${id}/fields`),
    ]);

    setTemplate(tplRes.data);
    const nextFields = fieldsRes.data?.fields || [];
    setFields(nextFields);
    setNewField((prev) => ({
      ...prev,
      field_name: getNextFieldName(nextFields),
    }));
    setTestData((prev) => {
      const next = { ...prev };
      nextFields.forEach((field) => {
        if (!next[field.field_name]) {
          next[field.field_name] =
            `Sample ${prettifyFieldName(field.field_name)}`;
        }
      });
      Object.keys(next).forEach((key) => {
        if (!nextFields.some((field) => field.field_name === key)) {
          delete next[key];
        }
      });
      return next;
    });
  };

  useEffect(() => {
    const run = async () => {
      try {
        setError("");
        await fetchTemplate();
      } catch (err) {
        setError(
          err?.response?.data?.message || "Failed to load template editor",
        );
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [id]);

  useEffect(() => {
    const node = previewContainerRef.current;
    if (!node || !canvasSize.width) return;

    const updateScale = () => {
      const availableWidth = Math.max(node.clientWidth - 16, 320);
      const nextScale = Math.min(1, availableWidth / canvasSize.width);
      setPreviewScale(Number(nextScale.toFixed(3)));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(node);
    return () => observer.disconnect();
  }, [canvasSize.width]);

  const imageUrl = useMemo(
    () => toStorageUrl(template?.image_path),
    [template?.image_path],
  );

  useEffect(() => {
    if (!imageUrl) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const width = Math.round(img.naturalWidth || 0);
      const height = Math.round(img.naturalHeight || 0);
      if (width > 0 && height > 0) {
        setCanvasSize({ width, height });
      }
    };
    img.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  const updateField = async (fieldId, payload) => {
    await API.put(`/templates/fields/${fieldId}`, payload);
  };

  const handleStopDrag = async (field, data) => {
    const payload = {
      ...field,
      x_position: data.x,
      y_position: data.y,
    };

    try {
      await updateField(field.id, payload);
      setFields((prev) =>
        prev.map((item) =>
          item.id === field.id ? { ...item, ...payload } : item,
        ),
      );
    } catch (err) {
      setError(
        err?.response?.data?.message || "Failed to update field position",
      );
    }
  };

  const handleFieldChange = (fieldId, key, value) => {
    setFields((prev) =>
      prev.map((item) =>
        item.id === fieldId ? { ...item, [key]: value } : item,
      ),
    );
  };

  const saveField = async (field) => {
    setSaving(true);
    try {
      setError("");
      await updateField(field.id, field);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save field");
    } finally {
      setSaving(false);
    }
  };

  const addField = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      setError("");
      const payload = {
        ...newField,
        field_name: getNextFieldName(fields),
      };
      await API.post(`/templates/${id}/fields`, payload);
      setNewField((prev) => ({
        ...defaultField,
        field_name: getNextFieldName([...fields, payload]),
      }));
      await fetchTemplate();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to add field");
    } finally {
      setSaving(false);
    }
  };

  const addCommonFields = async () => {
    setSaving(true);

    try {
      setError("");
      let nextIndex =
        fields.reduce((max, field) => {
          const match = String(field.field_name || "").match(/^field_(\d+)$/i);
          if (!match) return max;
          return Math.max(max, Number(match[1] || 0));
        }, 0) + 1;
      const numberedFields = commonFieldPresets.map((field) => ({
          ...defaultField,
          field_name: `field_${nextIndex++}`,
          x_position: Math.round(canvasSize.width * field.x_pct),
          y_position: Math.round(canvasSize.height * field.y_pct),
          font_size: field.font_size,
        }));

      await Promise.all(
        numberedFields.map((field) => API.post(`/templates/${id}/fields`, field)),
      );
      await fetchTemplate();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to add common fields");
    } finally {
      setSaving(false);
    }
  };

  const deleteField = async (fieldId) => {
    try {
      setError("");
      await API.delete(`/templates/fields/${fieldId}`);
      setFields((prev) => prev.filter((item) => item.id !== fieldId));
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to delete field");
    }
  };

  const updateSignature = async () => {
    if (!template) return;

    setSaving(true);
    try {
      setError("");
      await API.patch(`/templates/${id}/signature-position`, {
        signature_x: Number(template.signature_x || 0),
        signature_y: Number(template.signature_y || 0),
      });
      setTemplate((prev) => ({
        ...prev,
        signature_x: Number(template.signature_x || 0),
        signature_y: Number(template.signature_y || 0),
      }));
    } catch (err) {
      setError(
        err?.response?.data?.message || "Failed to update signature position",
      );
    } finally {
      setSaving(false);
    }
  };

  const updateQrPosition = async (qr_x, qr_y) => {
    if (!template) return;

    setSaving(true);
    try {
      setError("");
      const qr_size = Math.max(Number(template?.qr_size || 120), 20);
      await API.patch(`/templates/${id}/qr-position`, {
        qr_x,
        qr_y,
        qr_size,
      });
      setTemplate((prev) => ({ ...prev, qr_x, qr_y, qr_size }));
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update QR position");
    } finally {
      setSaving(false);
    }
  };

  const handleQrDragStop = async (_, data) => {
    setTemplate((prev) => ({ ...prev, qr_x: data.x, qr_y: data.y }));
    await updateQrPosition(data.x, data.y);
  };

  const clampToCanvas = (value, axis) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    const max = axis === "x" ? canvasSize.width - 1 : canvasSize.height - 1;
    return Math.min(Math.max(parsed, 0), Math.max(max, 0));
  };

  const isCoordinateSet = (value) =>
    value !== null &&
    value !== undefined &&
    value !== "" &&
    Number.isFinite(Number(value));

  const enableQr = async () => {
    const nextX = isCoordinateSet(template?.qr_x)
      ? Number(template.qr_x)
      : 900;
    const nextY = isCoordinateSet(template?.qr_y)
      ? Number(template.qr_y)
      : 500;
    const nextSize = Math.max(Number(template?.qr_size || 120), 20);
    setTemplate((prev) => ({
      ...prev,
      qr_x: nextX,
      qr_y: nextY,
      qr_size: nextSize,
    }));
    await updateQrPosition(nextX, nextY);
  };

  const disableQr = async () => {
    setTemplate((prev) => ({ ...prev, qr_x: null, qr_y: null }));
    await updateQrPosition(null, null);
  };

  const qrEnabled =
    isCoordinateSet(template?.qr_x) &&
    isCoordinateSet(template?.qr_y) &&
    Number(template?.qr_x) >= 0 &&
    Number(template?.qr_y) >= 0;

  const handlePlaceFieldByClick = async (event) => {
    if (!placingFieldId) return;
    const selectedField = fields.find((field) => field.id === placingFieldId);
    if (!selectedField) return;

    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect) return;
    const nextX = clampToCanvas(
      (event.clientX - rect.left) / Math.max(previewScale, 0.01),
      "x",
    );
    const nextY = clampToCanvas(
      (event.clientY - rect.top) / Math.max(previewScale, 0.01),
      "y",
    );
    const payload = {
      ...selectedField,
      x_position: nextX,
      y_position: nextY,
    };

    setFields((prev) =>
      prev.map((field) =>
        field.id === placingFieldId
          ? { ...field, x_position: nextX, y_position: nextY }
          : field,
      ),
    );

    try {
      await updateField(placingFieldId, payload);
      setPlacingFieldId(null);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Failed to place field on certificate",
      );
    }
  };

  const generateTestPreview = async () => {
    setPreviewing(true);
    setError("");
    try {
      const payload = fields.reduce((acc, field) => {
        acc[field.field_name] = testData[field.field_name] ?? "";
        return acc;
      }, {});

      const res = await API.post(`/templates/${id}/preview`, { data: payload });
      setTestPreviewUrl(res.data?.previewUrl || "");
    } catch (err) {
      setError(
        err?.response?.data?.message || "Failed to generate test certificate",
      );
    } finally {
      setPreviewing(false);
    }
  };

  const downloadTestPreview = async () => {
    if (!testPreviewUrl) return;
    try {
      const response = await fetch(testPreviewUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `template_${id}_test_certificate.png`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to download test certificate");
    }
  };

  if (loading) return <Loader label="Loading template editor..." />;
  if (!template) return <p className="text-red-600">Template not found.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Template Editor</h2>
        <p className="text-sm text-slate-500">
          Drag fields on top of template and save changes
        </p>
      </div>
      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="space-y-6">
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold">Preview</h3>
            <p className="text-sm text-slate-600">
              Fit: {Math.round(previewScale * 100)}%
            </p>
          </div>
          <div
            ref={previewContainerRef}
            className={`relative overflow-auto rounded border border-slate-200 bg-slate-50 ${
              placingFieldId ? "cursor-crosshair" : ""
            }`}
            style={{ maxHeight: "75vh" }}
          >
            <div
              className="relative mx-auto"
              style={{
                width: Math.max(1, Math.round(canvasSize.width * previewScale)),
                height: Math.max(1, Math.round(canvasSize.height * previewScale)),
              }}
              onClick={handlePlaceFieldByClick}
            >
              {imageUrl ? (
                <div
                  className="absolute inset-0 bg-no-repeat"
                  style={{
                    backgroundImage: `url(${imageUrl})`,
                    backgroundSize: "100% 100%",
                  }}
                />
              ) : (
                <div className="p-6 text-sm text-slate-500">
                  Template image not available.
                </div>
              )}

              {fields.map((field, index) =>
                (() => {
                  const nodeRef = getFieldNodeRef(field.id);
                  return (
                    <Draggable
                      key={field.id}
                      nodeRef={nodeRef}
                      bounds="parent"
                      onStart={() => {
                        setActiveFieldId(field.id);
                        setPlacingFieldId(null);
                        return true;
                      }}
                      position={{
                        x:
                          clampToCanvas(field.x_position || 0, "x") *
                          previewScale,
                        y:
                          clampToCanvas(field.y_position || 0, "y") *
                          previewScale,
                      }}
                      onDrag={(_, data) => {
                        handleFieldChange(
                          field.id,
                          "x_position",
                          clampToCanvas(
                            data.x / Math.max(previewScale, 0.01),
                            "x",
                          ),
                        );
                        handleFieldChange(
                          field.id,
                          "y_position",
                          clampToCanvas(
                            data.y / Math.max(previewScale, 0.01),
                            "y",
                          ),
                        );
                      }}
                      onStop={(_, data) =>
                        handleStopDrag(field, {
                          x: clampToCanvas(
                            data.x / Math.max(previewScale, 0.01),
                            "x",
                          ),
                          y: clampToCanvas(
                            data.y / Math.max(previewScale, 0.01),
                            "y",
                          ),
                        })
                      }
                    >
                      <div
                        ref={nodeRef}
                        onMouseDown={() => setActiveFieldId(field.id)}
                        className={`absolute cursor-move select-none whitespace-nowrap rounded border border-dashed px-0.5 py-0 ${
                          placingFieldId === field.id
                            ? "border-blue-500"
                            : "border-transparent hover:border-slate-400"
                        }`}
                        style={{
                          fontSize:
                            Number(field.font_size || 20) * previewScale,
                          color: field.font_color || "#000000",
                          fontFamily: field.font_family || "Arial",
                          lineHeight: 1.1,
                          backgroundColor: "transparent",
                          zIndex:
                            activeFieldId === field.id ? 50 : 10 + index,
                        }}
                      >
                        {testData[field.field_name] || field.field_name || "Field"}
                      </div>
                    </Draggable>
                  );
                })(),
              )}

              {qrEnabled && (
                <Draggable
                  nodeRef={qrNodeRef}
                  bounds="parent"
                  position={{
                    x: Number(template.qr_x || 0) * previewScale,
                    y: Number(template.qr_y || 0) * previewScale,
                  }}
                  onStop={(_, data) =>
                    handleQrDragStop(_, {
                      x: clampToCanvas(
                        data.x / Math.max(previewScale, 0.01),
                        "x",
                      ),
                      y: clampToCanvas(
                        data.y / Math.max(previewScale, 0.01),
                        "y",
                      ),
                    })
                  }
                >
                  <div
                    ref={qrNodeRef}
                    className="absolute flex cursor-move items-center justify-center rounded border-2 border-green-700 bg-green-500/40 text-xs font-semibold text-green-900"
                    style={{
                      width: Math.max(
                        Math.round(Number(template?.qr_size || 120) * previewScale),
                        20,
                      ),
                      height: Math.max(
                        Math.round(Number(template?.qr_size || 120) * previewScale),
                        20,
                      ),
                    }}
                  >
                    QR
                  </div>
                </Draggable>
              )}
            </div>
          </div>
          {placingFieldId && (
            <p className="text-sm text-blue-700">
              Click on the certificate preview to set selected field position.
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold">Add Field</h3>
            <form
              onSubmit={addField}
              className="grid grid-cols-2 gap-3 text-sm"
            >
              <input
                className="col-span-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-slate-600"
                placeholder="field_name"
                value={newField.field_name || getNextFieldName(fields)}
                readOnly
              />
              <input
                type="number"
                min="0"
                className="rounded-md border border-slate-300 px-3 py-2"
                placeholder="X"
                value={newField.x_position}
                onChange={(e) =>
                  setNewField((p) => ({
                    ...p,
                    x_position: clampToCanvas(e.target.value, "x"),
                  }))
                }
              />
              <input
                type="number"
                min="0"
                className="rounded-md border border-slate-300 px-3 py-2"
                placeholder="Y"
                value={newField.y_position}
                onChange={(e) =>
                  setNewField((p) => ({
                    ...p,
                    y_position: clampToCanvas(e.target.value, "y"),
                  }))
                }
              />
              <input
                type="number"
                className="rounded-md border border-slate-300 px-3 py-2"
                placeholder="Font Size"
                value={newField.font_size}
                onChange={(e) =>
                  setNewField((p) => ({
                    ...p,
                    font_size: Math.max(8, Number(e.target.value)),
                  }))
                }
                min="8"
                max="180"
              />
              <select
                className="rounded-md border border-slate-300 bg-white px-3 py-2"
                value={newField.font_family}
                onChange={(e) =>
                  setNewField((p) => ({ ...p, font_family: e.target.value }))
                }
              >
                {fontFamilyOptions.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
              <div className="col-span-2 flex items-center gap-2">
                <input
                  type="color"
                  className="h-10 w-14 rounded-md border border-slate-300 bg-white px-1"
                  value={newField.font_color}
                  onChange={(e) =>
                    setNewField((p) => ({ ...p, font_color: e.target.value }))
                  }
                />
                <input
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 font-mono uppercase"
                  value={newField.font_color}
                  onChange={(e) =>
                    setNewField((p) => ({ ...p, font_color: e.target.value }))
                  }
                  placeholder="#000000"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="col-span-2 rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
              >
                Add Field
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={addCommonFields}
                className="col-span-2 rounded-md border border-slate-300 px-4 py-2 font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                Add 4 Numbered Fields
              </button>
            </form>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold">Test Certificate</h3>
            <div className="space-y-3 text-sm">
              {fields.map((field) => (
                <label key={`test-${field.id}`} className="block">
                  <span className="mb-1 block text-slate-600">
                    {field.field_name}
                  </span>
                  <input
                    className="w-full rounded border border-slate-300 px-2 py-1"
                    value={testData[field.field_name] ?? ""}
                    onChange={(e) =>
                      setTestData((prev) => ({
                        ...prev,
                        [field.field_name]: e.target.value,
                      }))
                    }
                    placeholder={`Sample ${prettifyFieldName(field.field_name)}`}
                  />
                </label>
              ))}
              {!fields.length && (
                <p className="text-slate-500">
                  Add fields first to test text placement.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={previewing || !fields.length}
                  onClick={generateTestPreview}
                  className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
                >
                  {previewing ? "Generating..." : "Generate Test Certificate"}
                </button>
                <button
                  type="button"
                  disabled={!testPreviewUrl}
                  onClick={downloadTestPreview}
                  className="rounded-md border border-slate-300 px-4 py-2 font-medium hover:bg-slate-50 disabled:opacity-40"
                >
                  Download Test Certificate
                </button>
              </div>
              {testPreviewUrl && (
                <div className="rounded border border-slate-200 p-2">
                  <img
                    src={testPreviewUrl}
                    alt="Test certificate preview"
                    className="w-full"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold">QR Position</h3>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <input
                type="number"
                min="0"
                className="rounded-md border border-slate-300 px-3 py-2"
                value={template.qr_x ?? ""}
                onChange={(e) =>
                  setTemplate((p) => ({
                    ...p,
                    qr_x:
                      e.target.value === ""
                        ? null
                        : clampToCanvas(e.target.value, "x"),
                  }))
                }
                placeholder="QR X"
                disabled={!qrEnabled}
              />
              <input
                type="number"
                min="0"
                className="rounded-md border border-slate-300 px-3 py-2"
                value={template.qr_y ?? ""}
                onChange={(e) =>
                  setTemplate((p) => ({
                    ...p,
                    qr_y:
                      e.target.value === ""
                        ? null
                        : clampToCanvas(e.target.value, "y"),
                  }))
                }
                placeholder="QR Y"
                disabled={!qrEnabled}
              />
              <input
                type="number"
                min="20"
                className="rounded-md border border-slate-300 px-3 py-2"
                value={Math.max(Number(template.qr_size || 120), 20)}
                onChange={(e) =>
                  setTemplate((p) => ({
                    ...p,
                    qr_size: Math.max(Number(e.target.value || 120), 20),
                  }))
                }
                placeholder="QR Size"
                disabled={!qrEnabled}
              />
              {qrEnabled ? (
                <>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      updateQrPosition(
                        Number(template.qr_x || 0),
                        Number(template.qr_y || 0),
                      )
                    }
                    className="rounded-md border border-slate-300 px-4 py-2 font-medium hover:bg-slate-50"
                  >
                    Save QR Position
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={disableQr}
                    className="rounded-md border border-red-300 px-4 py-2 font-medium text-red-700 hover:bg-red-50"
                  >
                    Remove QR
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      setTemplate((p) => ({
                        ...p,
                        qr_size: Math.max(Number(p.qr_size || 120) - 10, 20),
                      }))
                    }
                    className="rounded-md border border-slate-300 px-4 py-2 font-medium hover:bg-slate-50"
                  >
                    QR -
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      setTemplate((p) => ({
                        ...p,
                        qr_size: Math.max(Number(p.qr_size || 120) + 10, 20),
                      }))
                    }
                    className="rounded-md border border-slate-300 px-4 py-2 font-medium hover:bg-slate-50"
                  >
                    QR +
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={enableQr}
                  className="col-span-3 rounded-md border border-green-300 px-4 py-2 font-medium text-green-700 hover:bg-green-50"
                >
                  Add QR
                </button>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold">Signature Position</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <input
                type="number"
                min="0"
                className="rounded-md border border-slate-300 px-3 py-2"
                value={template.signature_x || 0}
                onChange={(e) =>
                  setTemplate((p) => ({
                    ...p,
                    signature_x: clampToCanvas(e.target.value, "x"),
                  }))
                }
              />
              <input
                type="number"
                min="0"
                className="rounded-md border border-slate-300 px-3 py-2"
                value={template.signature_y || 0}
                onChange={(e) =>
                  setTemplate((p) => ({
                    ...p,
                    signature_y: clampToCanvas(e.target.value, "y"),
                  }))
                }
              />
              <button
                type="button"
                disabled={saving}
                onClick={updateSignature}
                className="col-span-2 rounded-md border border-slate-300 px-4 py-2 font-medium hover:bg-slate-50"
              >
                Save Signature Position
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold">Field Settings</h3>
            <div className="space-y-3">
              {fields.map((field) => (
                <div
                  key={field.id}
                  className="rounded-md border border-slate-200 p-3 text-sm"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="col-span-2 rounded border border-slate-300 bg-slate-50 px-2 py-1 text-slate-600"
                      value={field.field_name || ""}
                      readOnly
                    />
                    <input
                      type="number"
                      min="0"
                      className="rounded border border-slate-300 px-2 py-1"
                      value={field.x_position || 0}
                      onChange={(e) =>
                        handleFieldChange(
                          field.id,
                          "x_position",
                          clampToCanvas(e.target.value, "x"),
                        )
                      }
                    />
                    <input
                      type="number"
                      min="0"
                      className="rounded border border-slate-300 px-2 py-1"
                      value={field.y_position || 0}
                      onChange={(e) =>
                        handleFieldChange(
                          field.id,
                          "y_position",
                          clampToCanvas(e.target.value, "y"),
                        )
                      }
                    />
                    <input
                      type="number"
                      min="8"
                      max="180"
                      className="rounded border border-slate-300 px-2 py-1"
                      value={field.font_size || 30}
                      onChange={(e) =>
                        handleFieldChange(
                          field.id,
                          "font_size",
                          Math.max(8, Number(e.target.value)),
                        )
                      }
                    />
                    <select
                      className="rounded border border-slate-300 bg-white px-2 py-1"
                      value={field.font_family || "Arial"}
                      onChange={(e) =>
                        handleFieldChange(
                          field.id,
                          "font_family",
                          e.target.value,
                        )
                      }
                    >
                      {fontFamilyOptions.map((font) => (
                        <option key={font} value={font}>
                          {font}
                        </option>
                      ))}
                    </select>
                    <div className="col-span-2 flex items-center gap-2">
                      <input
                        type="color"
                        className="h-9 w-14 rounded border border-slate-300 bg-white px-1"
                        value={field.font_color || "#000000"}
                        onChange={(e) =>
                          handleFieldChange(
                            field.id,
                            "font_color",
                            e.target.value,
                          )
                        }
                      />
                      <input
                        className="flex-1 rounded border border-slate-300 px-2 py-1 font-mono uppercase"
                        value={field.font_color || "#000000"}
                        onChange={(e) =>
                          handleFieldChange(
                            field.id,
                            "font_color",
                            e.target.value,
                          )
                        }
                        placeholder="#000000"
                      />
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPlacingFieldId((prev) =>
                          prev === field.id ? null : field.id,
                        )
                      }
                      className="rounded border border-slate-300 px-3 py-1"
                    >
                      {placingFieldId === field.id
                        ? "Cancel Place"
                        : "Place by Click"}
                    </button>
                    <button
                      type="button"
                      onClick={() => saveField(field)}
                      className="rounded bg-blue-600 px-3 py-1 text-white"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteField(field.id)}
                      className="rounded bg-red-600 px-3 py-1 text-white"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {!fields.length && (
                <p className="text-slate-500">No fields added.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
