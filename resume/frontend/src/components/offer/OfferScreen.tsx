import { useState } from 'react';
import { useATS } from '../../context/ATSContext';

export default function OfferScreen() {
  const {
    currentCandidate,
    currentRecord,
    navigate,
    offerForm,
    setOfferForm,
    submitOffer,
    rejectCurrentCandidate,
  } = useATS();
  const [preview, setPreview] = useState<'idle' | 'offer' | 'rejection'>('idle');

  if (!currentCandidate || !currentRecord) return null;

  async function generateOffer() {
    await submitOffer();
    setPreview('offer');
  }

  async function sendRejection() {
    await rejectCurrentCandidate();
    setPreview('rejection');
  }

  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div>
      {/* Topbar */}
      <div className="h-[52px] bg-white border-b border-stone-200 flex items-center px-6 gap-2 sticky top-0 z-50">
        <span className="text-[13px] text-stone-400 hover:text-stone-700 cursor-pointer transition-colors" onClick={() => navigate('dashboard')}>Recruitment</span>
        <span className="text-stone-300">/</span>
        <span className="text-[13px] text-stone-400 hover:text-stone-700 cursor-pointer transition-colors" onClick={() => navigate('results')}>{currentRecord.role}</span>
        <span className="text-stone-300">/</span>
        <span className="text-[13px] text-stone-400 hover:text-stone-700 cursor-pointer transition-colors" onClick={() => navigate('candidate')}>{currentCandidate.name}</span>
        <span className="text-stone-300">/</span>
        <span className="text-[13px] text-stone-800 font-medium">Offer / Rejection</span>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-2 gap-4">
          {/* Form */}
          <div className="bg-white border border-stone-200 rounded-xl p-[18px]">
            <div className="text-[14px] font-semibold text-stone-800 mb-4">Offer letter</div>

            {[
              { label: 'Designation', field: 'designation', placeholder: `e.g. ${currentRecord.role}` },
              { label: 'CTC (per annum)', field: 'ctc', placeholder: 'e.g. ₹12,00,000' },
              { label: 'Joining date', field: 'joiningDate', placeholder: 'e.g. 1 June 2026' },
              { label: 'Reporting to', field: 'reportingTo', placeholder: 'e.g. Rahul Mehta, Head of Content' },
            ].map(({ label, field, placeholder }) => (
              <div key={field} className="mb-3.5">
                <label className="block text-[12px] font-medium text-stone-500 mb-1.5">{label}</label>
                <input
                  className="w-full px-3 py-2 border border-stone-300 rounded-md text-[13px] outline-none focus:border-purple-500 bg-white"
                  placeholder={placeholder}
                  value={offerForm[field as keyof typeof offerForm]}
                  onChange={e => setOfferForm({ [field]: e.target.value })}
                />
              </div>
            ))}

            <div className="mb-4">
              <label className="block text-[12px] font-medium text-stone-500 mb-1.5">Additional note</label>
              <textarea
                className="w-full px-3 py-2 border border-stone-300 rounded-md text-[13px] outline-none focus:border-purple-500 bg-white resize-y min-h-[80px]"
                placeholder="Any additional terms or notes..."
                value={offerForm.additionalNote}
                onChange={e => setOfferForm({ additionalNote: e.target.value })}
              />
            </div>

            <div className="flex gap-2">
              <button onClick={() => void generateOffer()} className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#534AB7] text-white text-xs font-medium rounded-md hover:bg-[#453da0] transition-colors">
                Generate offer letter
              </button>
              <button onClick={() => void sendRejection()} className="inline-flex items-center gap-1.5 px-4 py-2 border border-red-200 bg-white text-red-700 text-xs font-medium rounded-md hover:bg-red-50 transition-colors">
                Send rejection
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white border border-stone-200 rounded-xl p-[18px] min-h-[300px]">
            {preview === 'idle' && (
              <div className="flex items-center justify-center h-full min-h-[200px] text-[13px] text-stone-400">
                Fill the form and click "Generate offer letter"
              </div>
            )}

            {preview === 'offer' && (
              <div className="bg-[#fffdf8] border border-stone-200 rounded-xl p-8 font-mono text-[12px] leading-[1.8] text-stone-800">
                <h3 className="font-sans text-[16px] font-semibold mb-4 text-stone-900">Offer of employment</h3>
                <p>Date: {today}</p>
                <br />
                <p>Dear <strong>{currentCandidate.name}</strong>,</p>
                <br />
                <p>We are pleased to extend this offer of employment for the position of <strong>{offerForm.designation || currentRecord.role}</strong> at ObserveNow Media.</p>
                <br />
                <p><strong>Compensation:</strong> {offerForm.ctc || 'To be discussed'} per annum, subject to applicable deductions.</p>
                <p><strong>Joining date:</strong> {offerForm.joiningDate || 'Immediate'}</p>
                <p><strong>Reporting to:</strong> {offerForm.reportingTo || 'Reporting Manager'}</p>
                {offerForm.additionalNote && <p><strong>Additional terms:</strong> {offerForm.additionalNote}</p>}
                <br />
                <p>This offer is contingent upon successful completion of background verification and submission of required documents.</p>
                <br />
                <p>Please confirm your acceptance by signing and returning this letter within 3 working days.</p>
                <br />
                <p>We look forward to welcoming you to the team.</p>
                <br />
                <p>Warm regards,<br /><strong>Anchal</strong><br />HR Manager, ObserveNow People</p>
              </div>
            )}

            {preview === 'rejection' && (
              <div className="bg-[#fffdf8] border border-stone-200 rounded-xl p-8 font-mono text-[12px] leading-[1.8] text-stone-800">
                <h3 className="font-sans text-[16px] font-semibold mb-4 text-stone-900">Rejection sent</h3>
                <p>A rejection email has been sent to <strong>{currentCandidate.name}</strong>.</p>
                <br />
                <p>Dear {currentCandidate.name},</p>
                <br />
                <p>Thank you for your interest in the <strong>{currentRecord.role}</strong> position at ObserveNow Media. After careful consideration, we regret to inform you that we will not be moving forward with your application at this time.</p>
                <br />
                <p>We appreciate your time and wish you all the best in your job search.</p>
                <br />
                <p>Warm regards,<br /><strong>Anchal</strong><br />HR Manager</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
