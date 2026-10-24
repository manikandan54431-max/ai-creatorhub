import { useState, useRef, useEffect } from 'react'
import { Upload, Video, CheckCircle, Clock, AlertCircle, XCircle, RotateCcw, Eye, X, FileVideo, Image } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import api from '../../services/api'

const STATUS_INFO = {
  draft: { label: 'Draft', icon: '📝', color: 'status-draft', desc: 'Not yet submitted for review' },
  pending_review: { label: 'Pending Admin Review', icon: '⏳', color: 'status-pending_review', desc: 'Waiting for admin to review your video' },
  changes_requested: { label: 'Changes Requested', icon: '⚠️', color: 'status-changes_requested', desc: 'Admin has requested changes. See feedback below.' },
  approved: { label: 'Approved & Delivered', icon: '✅', color: 'status-approved', desc: 'Your video was approved and delivered to the client' },
  superseded: { label: 'Superseded by New Version', icon: '🔄', color: 'status-superseded', desc: 'A newer version has been approved' },
}

const MAX_MB_DEFAULT = 500

export default function CreatorDeliverySubmission({ order, onDeliveryChange }) {
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploadConfig, setUploadConfig] = useState({ max_video_size_mb: MAX_MB_DEFAULT })
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedVideo, setSelectedVideo] = useState(null)
  const [selectedThumb, setSelectedThumb] = useState(null)
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(null)
  const [formData, setFormData] = useState({ title: '', description: '' })
  const videoRef = useRef(null)
  const fileInputRef = useRef(null)
  const thumbInputRef = useRef(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadSubmissions()
    loadConfig()
  }, [order.id])

  async function loadSubmissions() {
    try {
      const res = await api.get(`/api/orders/${order.id}/deliveries`)
      setSubmissions(res.data)
    } catch (e) {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  async function loadConfig() {
    try {
      const res = await api.get('/api/deliveries/config')
      setUploadConfig(res.data)
    } catch (e) {}
  }

  function handleVideoSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return

    const maxBytes = uploadConfig.max_video_size_mb * 1024 * 1024
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['mp4', 'webm', 'mov'].includes(ext)) {
      toast.error('Unsupported format. Please use MP4, WebM, or MOV.')
      return
    }
    if (file.size > maxBytes) {
      toast.error(`File exceeds the ${uploadConfig.max_video_size_mb} MB limit.`)
      return
    }
    setSelectedVideo(file)
    const url = URL.createObjectURL(file)
    setVideoPreviewUrl(url)
    if (!formData.title) {
      setFormData(f => ({ ...f, title: file.name.replace(/\.[^.]+$/, '') }))
    }
  }

  function handleThumbSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedThumb(file)
  }

  function removeVideo() {
    setSelectedVideo(null)
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl)
    setVideoPreviewUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function formatFileSize(bytes) {
    if (!bytes) return 'Unknown'
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  async function handleUploadAndDraft(e) {
    e.preventDefault()
    if (!selectedVideo) { toast.error('Please select a video file.'); return }
    if (!formData.title.trim()) { toast.error('Please enter a video title.'); return }

    const fd = new FormData()
    fd.append('title', formData.title)
    fd.append('description', formData.description || '')
    fd.append('video', selectedVideo)
    if (selectedThumb) fd.append('thumbnail', selectedThumb)

    setUploading(true)
    setUploadProgress(0)

    try {
      const res = await api.post(`/api/orders/${order.id}/deliveries`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (pe) => {
          setUploadProgress(Math.round((pe.loaded / pe.total) * 100))
        },
      })
      toast.success('Video uploaded! You can now submit it for review.')
      setSubmissions(prev => [res.data, ...prev])
      setShowUploadForm(false)
      removeVideo()
      setSelectedThumb(null)
      setFormData({ title: '', description: '' })
      if (onDeliveryChange) onDeliveryChange()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  async function handleSubmitForReview(deliveryId) {
    setSubmitting(true)
    try {
      const res = await api.post(`/api/deliveries/${deliveryId}/submit`)
      toast.success('Submitted for admin review!')
      setSubmissions(prev => prev.map(s => s.id === deliveryId ? res.data : s))
      if (onDeliveryChange) onDeliveryChange()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  const latestSubmission = submissions[0]
  const canUploadNew = !latestSubmission ||
    latestSubmission.status === 'changes_requested' ||
    latestSubmission.status === 'approved' ||
    latestSubmission.status === 'superseded'

  const allowedOrders = ['assigned', 'in_progress', 'revision_requested', 'accepted']
  if (!allowedOrders.includes(order.status)) {
    return (
      <div className="card" style={{ padding: 24, marginTop: 24 }}>
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎬</div>
          <p>Video delivery is not available for this order status ({order.status}).</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileVideo size={20} color="var(--ms-blue)" />
              Submit Video for Review
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
              Your video goes to admin review before being delivered to the client.
            </p>
          </div>
          {canUploadNew && !showUploadForm && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowUploadForm(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Upload size={14} />
              Upload Video
            </button>
          )}
        </div>

        {/* Upload Form */}
        <AnimatePresence>
          {showUploadForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: 20, marginBottom: 24, border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h4 style={{ margin: 0 }}>New Video Submission</h4>
                  <button onClick={() => { setShowUploadForm(false); removeVideo() }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleUploadAndDraft}>
                  {/* Video title */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                      Video Title *
                    </label>
                    <input
                      className="input-base"
                      value={formData.title}
                      onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
                      placeholder="e.g. Final Product Launch Video v1"
                      required
                    />
                  </div>

                  {/* Description */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                      Delivery Notes
                    </label>
                    <textarea
                      className="input-base"
                      value={formData.description}
                      onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                      placeholder="Describe what you delivered and any notes for the admin/client..."
                      rows={3}
                      style={{ resize: 'vertical', minHeight: 80 }}
                    />
                  </div>

                  {/* Video Upload */}
                  {!selectedVideo ? (
                    <div
                      className="upload-zone"
                      onClick={() => fileInputRef.current?.click()}
                      style={{ marginBottom: 14 }}
                    >
                      <Video size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Click to select video</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                        MP4, WebM, MOV — max {uploadConfig.max_video_size_mb} MB
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                        style={{ display: 'none' }}
                        onChange={handleVideoSelect}
                      />
                    </div>
                  ) : (
                    <div style={{ marginBottom: 14 }}>
                      {/* Preview */}
                      {videoPreviewUrl && (
                        <div className="video-container" style={{ marginBottom: 12 }}>
                          <video
                            ref={videoRef}
                            src={videoPreviewUrl}
                            controls
                            preload="metadata"
                            style={{ borderRadius: 8 }}
                          />
                        </div>
                      )}
                      {/* File info */}
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                        borderRadius: 8, padding: '10px 14px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <FileVideo size={18} color="var(--ms-blue)" />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{selectedVideo.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {formatFileSize(selectedVideo.size)} · {selectedVideo.type || 'video'}
                            </div>
                          </div>
                        </div>
                        <button type="button" onClick={removeVideo}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)' }}>
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Thumbnail Upload */}
                  <div style={{ marginBottom: 16 }}>
                    <button
                      type="button"
                      onClick={() => thumbInputRef.current?.click()}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <Image size={14} />
                      {selectedThumb ? `Thumbnail: ${selectedThumb.name}` : 'Add thumbnail (optional)'}
                    </button>
                    <input
                      ref={thumbInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      style={{ display: 'none' }}
                      onChange={handleThumbSelect}
                    />
                  </div>

                  {/* Upload progress */}
                  {uploading && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Uploading...</span>
                        <span style={{ fontWeight: 600 }}>{uploadProgress}%</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={uploading || !selectedVideo}
                    style={{ width: '100%' }}
                  >
                    {uploading ? 'Uploading...' : 'Upload Video (Save as Draft)'}
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submissions list */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 80 }} />)}
          </div>
        ) : submissions.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 0' }}>
            <div className="empty-state-icon">🎬</div>
            <p style={{ fontSize: 14 }}>No videos submitted yet. Upload your completed video above.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {submissions.map((sub) => (
              <SubmissionCard
                key={sub.id}
                submission={sub}
                onSubmitForReview={handleSubmitForReview}
                submitting={submitting}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SubmissionCard({ submission: sub, onSubmitForReview, submitting }) {
  const status = STATUS_INFO[sub.status] || { label: sub.status, icon: '•', color: 'badge-neutral' }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        border: '1px solid var(--border-color)',
        borderRadius: 10,
        padding: 16,
        background: 'var(--bg-secondary)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 16 }}>{status.icon}</span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{sub.title}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
              v{sub.version_number}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span className={`badge ${status.color}`} style={{ fontSize: 11 }}>
              {status.label}
            </span>
            {sub.submitted_at && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Submitted {new Date(sub.submitted_at).toLocaleDateString()}
              </span>
            )}
            {sub.approved_at && (
              <span style={{ fontSize: 12, color: 'var(--success)' }}>
                ✅ Approved {new Date(sub.approved_at).toLocaleDateString()}
              </span>
            )}
          </div>

          {sub.description && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 8px' }}>
              {sub.description}
            </p>
          )}

          {/* File info */}
          {sub.file_size && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              📁 {sub.original_filename} · {(sub.file_size / 1024 / 1024).toFixed(1)} MB · {sub.detected_content_type}
            </div>
          )}

          {/* Admin feedback */}
          {sub.creator_visible_feedback && (
            <div style={{
              marginTop: 10,
              background: 'var(--warning-light)',
              border: '1px solid var(--ms-yellow)',
              borderRadius: 8,
              padding: '10px 14px',
            }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--warning)', marginBottom: 4 }}>
                ⚠️ Admin Feedback
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                {sub.creator_visible_feedback}
              </p>
            </div>
          )}

          {/* Delivery date */}
          {sub.delivered_at && (
            <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 6 }}>
              🚀 Delivered to client: {new Date(sub.delivered_at).toLocaleString()}
            </div>
          )}
        </div>

        {/* Action */}
        {sub.status === 'draft' && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onSubmitForReview(sub.id)}
            disabled={submitting}
            style={{ flexShrink: 0 }}
          >
            Submit to Admin
          </button>
        )}
      </div>

      {/* Submitted message */}
      {sub.status === 'pending_review' && (
        <div style={{
          marginTop: 10,
          padding: '8px 12px',
          background: 'var(--info-light)',
          borderRadius: 6,
          fontSize: 13,
          color: 'var(--info)',
          fontWeight: 500,
        }}>
          📬 Your video has been submitted for admin review. The client will receive it only after approval.
        </div>
      )}
    </motion.div>
  )
}
