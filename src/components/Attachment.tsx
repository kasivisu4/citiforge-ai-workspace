import React, { useState } from 'react';
import { Paperclip } from 'lucide-react';

interface AttachmentProps {
  onAttach: (files: FileList) => void;
}

export const Attachment: React.FC<AttachmentProps> = ({ onAttach }) => {
  const [preview, setPreview] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    onAttach(files);
    const file = files[0];
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string | null);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      {preview && (<img src={preview} alt="preview" className="h-8 w-8 rounded" />)}
      <label htmlFor="attach-file" className="cursor-pointer text-gray-500 hover:text-gray-700"><Paperclip size={20} /></label>
      <input id="attach-file" type="file" accept="image/*,application/pdf,.docx" onChange={handleChange} className="hidden" />
    </div>
  );
};