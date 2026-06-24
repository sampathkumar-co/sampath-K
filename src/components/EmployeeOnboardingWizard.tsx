import React, { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, User, Building, DollarSign, CheckCircle2, ChevronRight, ChevronLeft, RefreshCcw, Upload, ShieldCheck, X } from 'lucide-react';
import { getDB, setDB, addAuditLog } from '../lib/store';
import { Employee } from '../types';

interface OnboardingWizardProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function EmployeeOnboardingWizard({ onClose, onSuccess }: OnboardingWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [name, setName] = useState('');
  const [shopId, setShopId] = useState('');
  const [wageType, setWageType] = useState<'monthly' | 'daily' | 'hourly'>('monthly');
  const [wageAmount, setWageAmount] = useState<number | ''>('');
  const [shiftStart, setShiftStart] = useState('09:00');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [fileFallback, setFileFallback] = useState(false);
  const [onboardingLocation, setOnboardingLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setOnboardingLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (err) => {
          console.warn("Could not capture admin location for onboarding log:", err);
        }
      );
    }
  }, []);

  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const db = getDB();
  const activeShops = db.shops;

  const handleCapture = () => {
    try {
      const screenshot = webcamRef.current?.getScreenshot();
      if (screenshot) {
        setCapturedPhoto(screenshot);
        setCameraError(null);
      } else {
        setCameraError('Failed to capture from webcam. Try again or upload a photo.');
      }
    } catch (err) {
      setCameraError('An error occurred during capture. Try uploading a photo.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedPhoto(reader.result as string);
        setCameraError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const validateStep = () => {
    if (step === 1) {
      if (!name.trim()) return 'Please enter employee name';
      if (!shopId) return 'Please select a shop location';
    }
    if (step === 2) {
      if (wageAmount === '' || wageAmount <= 0) return 'Please enter a valid wage amount';
    }
    if (step === 3) {
      if (!capturedPhoto) return 'Please register a face photo for authorization';
    }
    return null;
  };

  const handleNext = () => {
    const errorMsg = validateStep();
    if (errorMsg) {
      alert(errorMsg);
      return;
    }
    if (step < 4) {
      setStep((prev) => (prev + 1) as any);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => (prev - 1) as any);
    }
  };

  const handleComplete = () => {
    if (!name || !shopId || !wageType || !wageAmount || !capturedPhoto) {
      alert('Missing onboarding details. Please review all steps.');
      return;
    }

    const newEmployee: Employee = {
      id: `emp-${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      shopId,
      wageType,
      wageAmount: Number(wageAmount),
      facePhotoUrl: capturedPhoto,
      shiftStart
    };

    const currentDb = getDB();
    currentDb.employees.push(newEmployee);
    setDB(currentDb);

    addAuditLog(
      'admin',
      'Employee Onboarded',
      `Onboarded ${newEmployee.name} with ${wageType} salary of $${wageAmount} at shop ${
        activeShops.find((s) => s.id === shopId)?.name || shopId
      }`,
      undefined,
      onboardingLocation?.lat,
      onboardingLocation?.lng
    );

    onSuccess();
  };

  const selectedShopName = activeShops.find((s) => s.id === shopId)?.name || 'Unknown Shop';

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col border border-gray-100 max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold flex items-center">
              <ShieldCheck className="mr-2 text-emerald-400" size={22} /> Employee Onboarding Wizard
            </h3>
            <p className="text-xs text-slate-300">Guide a new hire through formal system registration</p>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition p-1.5 hover:bg-slate-800 rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="bg-gray-50 border-b border-gray-100 px-6 py-4">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: 'Identity', icon: User },
              { num: 2, label: 'Compensation', icon: DollarSign },
              { num: 3, label: 'Face Scan', icon: Camera },
              { num: 4, label: 'Review', icon: CheckCircle2 }
            ].map((s) => (
              <div key={s.num} className="flex items-center flex-1 last:flex-initial">
                <div className="flex items-center space-x-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs transition-colors duration-200 ${
                    step === s.num 
                      ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-100' 
                      : step > s.num 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-gray-200 text-gray-600'
                  }`}>
                    {step > s.num ? <CheckCircle2 size={16} /> : s.num}
                  </div>
                  <span className={`text-xs font-medium hidden sm:inline ${step === s.num ? 'text-gray-900 font-bold' : 'text-gray-500'}`}>
                    {s.label}
                  </span>
                </div>
                {s.num < 4 && (
                  <div className={`h-0.5 flex-1 mx-4 transition-colors duration-200 ${step > s.num ? 'bg-emerald-300' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {step === 1 && (
            <div className="space-y-5 animate-fadeIn">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start space-x-3">
                <User className="text-blue-600 mt-0.5" size={18} />
                <div className="text-xs text-blue-800">
                  <p className="font-semibold">Step 1: Primary Profile Details</p>
                  <p className="mt-0.5">Please provide the staff member's full legal name and associate them with a designated retail shop location.</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700">Full Legal Name</label>
                <div className="mt-1.5 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <User size={16} />
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Eleanor Vance"
                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700">Designated Retail Shop</label>
                <div className="mt-1.5 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Building size={16} />
                  </div>
                  <select
                    required
                    value={shopId}
                    onChange={(e) => setShopId(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  >
                    <option value="">Choose designated shop location...</option>
                    {activeShops.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.deviceId})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5 animate-fadeIn">
              <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl flex items-start space-x-3">
                <DollarSign className="text-purple-600 mt-0.5" size={18} />
                <div className="text-xs text-purple-800">
                  <p className="font-semibold">Step 2: Compensation Structure</p>
                  <p className="mt-0.5">Configure how payroll records will be automatically drafted for this employee at the end of the month cycle.</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700">Wage Structure Type</label>
                <div className="mt-2 grid grid-cols-3 gap-3">
                  {[
                    { value: 'monthly', title: 'Monthly Salary', desc: 'Fixed base rate / month' },
                    { value: 'daily', title: 'Daily Wage', desc: 'Flat rate per work day' },
                    { value: 'hourly', title: 'Hourly Wage', desc: 'Multiplied by hours logged' }
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setWageType(item.value as any)}
                      className={`p-3.5 border rounded-xl text-left transition flex flex-col justify-between ${
                        wageType === item.value
                          ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-100'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-xs font-bold text-gray-900">{item.title}</span>
                      <span className="text-[10px] text-gray-500 mt-1">{item.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700">Wage / Pay Amount ($)</label>
                <div className="mt-1.5 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 font-semibold text-sm">
                    $
                  </div>
                  <input
                    type="number"
                    required
                    min="1"
                    value={wageAmount}
                    onChange={(e) => setWageAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder={wageType === 'monthly' ? 'e.g. 3200' : wageType === 'daily' ? 'e.g. 150' : 'e.g. 18'}
                    className="block w-full pl-8 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {wageType === 'monthly' && 'The system compiles salaries based on active shop attendance days relative to 30 days.'}
                  {wageType === 'daily' && 'The system pays the employee the exact amount for each distinct calendar day verified.'}
                  {wageType === 'hourly' && 'Approximates standard 8 hour shifts per work attendance day.'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700">Daily Shift Start Deadline</label>
                <div className="mt-1.5 relative rounded-md shadow-sm">
                  <input
                    type="time"
                    required
                    value={shiftStart}
                    onChange={(e) => setShiftStart(e.target.value)}
                    className="block w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white font-medium"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Daily geofence check-ins recorded after this time will automatically trigger real-time manager late alerts.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-start space-x-3">
                <Camera className="text-emerald-600 mt-0.5" size={18} />
                <div className="text-xs text-emerald-800">
                  <p className="font-semibold">Step 3: Biometric Face Scan Enrollment</p>
                  <p className="mt-0.5">Capture or upload an initial facial model. This will be visible to shop managers when verifying daily check-in logs.</p>
                </div>
              </div>

              {cameraError && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700 font-medium">
                  {cameraError}
                </div>
              )}

              <div className="flex flex-col items-center justify-center">
                {capturedPhoto ? (
                  <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-md w-72 h-56 bg-slate-100 flex items-center justify-center">
                    <img src={capturedPhoto} alt="Captured Profile" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setCapturedPhoto(null)}
                      className="absolute top-2 right-2 bg-slate-900/80 text-white rounded-full p-1.5 hover:bg-slate-900 transition shadow"
                      title="Retake capture"
                    >
                      <RefreshCcw size={14} />
                    </button>
                    <div className="absolute bottom-0 inset-x-0 bg-emerald-500 text-white text-center text-[10px] font-semibold py-1">
                      BIO-SCAN MODEL CAPTURED
                    </div>
                  </div>
                ) : !fileFallback ? (
                  <div className="flex flex-col items-center w-full">
                    <div className="relative rounded-2xl overflow-hidden border border-gray-300 w-72 h-56 bg-slate-900 flex items-center justify-center">
                      {/* @ts-ignore */}
                      <Webcam
                        audio={false}
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        videoConstraints={{ width: 640, height: 480, facingMode: 'user' }}
                        className="w-full h-full object-cover"
                        onUserMediaError={() => {
                          setCameraError('Webcam access was denied or is unavailable. Switched to upload mode.');
                          setFileFallback(true);
                        }}
                      />
                      <div className="absolute inset-0 border border-white/20 rounded-2xl pointer-events-none flex items-center justify-center">
                        <div className="w-48 h-48 border border-dashed border-white/60 rounded-full opacity-60" />
                      </div>
                    </div>
                    <div className="mt-4 flex space-x-3">
                      <button
                        onClick={handleCapture}
                        className="bg-blue-600 text-white px-5 py-2 rounded-xl text-xs font-semibold hover:bg-blue-700 transition flex items-center space-x-1.5 shadow"
                      >
                        <Camera size={14} /> <span>Capture Snapshot</span>
                      </button>
                      <button
                        onClick={() => setFileFallback(true)}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 border border-gray-200"
                      >
                        <Upload size={14} /> <span>Upload Instead</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center w-72 h-56 border-2 border-dashed border-gray-300 rounded-2xl p-6 bg-gray-50 text-center">
                    <Upload className="text-gray-400 mb-2" size={32} />
                    <p className="text-xs text-gray-600 font-medium">Select a face image file from your disk</p>
                    <p className="text-[10px] text-gray-400 mt-1">Supports JPG, PNG formats</p>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-3 bg-white border border-gray-300 hover:border-gray-400 text-gray-700 px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm transition"
                    >
                      Browse File
                    </button>
                    <button
                      onClick={() => {
                        setFileFallback(false);
                        setCameraError(null);
                      }}
                      className="mt-2 text-blue-600 text-[10px] font-semibold hover:underline"
                    >
                      Use live camera instead
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5 animate-fadeIn">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-start space-x-3">
                <CheckCircle2 className="text-emerald-600 mt-0.5" size={18} />
                <div className="text-xs text-slate-700">
                  <p className="font-semibold text-slate-900">Step 4: Final Validation Review</p>
                  <p className="mt-0.5">Review the completed onboarding form below. Confirm the profile attributes before recording to store.</p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col sm:flex-row">
                {capturedPhoto && (
                  <div className="w-full sm:w-1/3 bg-slate-50 border-r border-gray-100 flex items-center justify-center p-4">
                    <img src={capturedPhoto} alt="Official Photo" className="w-28 h-28 sm:w-full sm:h-36 rounded-xl object-cover border border-gray-200" />
                  </div>
                )}
                <div className="p-5 flex-1 space-y-3">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Employee Name</span>
                    <p className="text-sm font-bold text-gray-900">{name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Shop Location</span>
                      <p className="text-xs font-semibold text-gray-700">{selectedShopName}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Compensation Base</span>
                      <p className="text-xs font-semibold text-gray-700 capitalize">${wageAmount} / {wageType}</p>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Access Privileges</span>
                    <p className="text-[11px] text-slate-500">Authorized for standard GPS attendance check-in/out and timesheet reporting</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className={`px-4 py-2 text-xs font-bold rounded-xl border border-gray-200 flex items-center text-gray-600 bg-white transition hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <ChevronLeft size={16} className="mr-1" /> Back
          </button>

          {step < 4 ? (
            <button
              onClick={handleNext}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 transition flex items-center text-white shadow-md"
            >
              Next <ChevronRight size={16} className="ml-1" />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 transition flex items-center text-white shadow-md"
            >
              Finalize Registration <CheckCircle2 size={16} className="ml-1.5" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
