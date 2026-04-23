import { useForm } from 'react-hook-form';
import { Button, Input, Select } from '../../components/ui';

export default function ProyekForm({ initial, onSave, onCancel }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: initial || { type: 'gedung' }
  });

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <Input label="Nama Proyek *" error={errors.name?.message} {...register('name', { required: 'Wajib diisi' })} placeholder="Cth: Pembangunan Rumah Type 45" />
      <Select label="Tipe Proyek" {...register('type')}>
        <option value="gedung">🏗️ Gedung</option>
        <option value="jalan">🛣️ Jalan / Infrastruktur</option>
      </Select>
      <Input label="Lokasi / Kota" {...register('lokasi')} placeholder="Cth: Jakarta Selatan" />
      <Input label="Nama Pemilik / Klien" {...register('pemilik')} placeholder="Cth: PT. Maju Jaya" />
      <Input label="Tanggal Mulai" type="date" {...register('tanggal_mulai')} />
      <Input label="Estimasi Selesai" type="date" {...register('estimasi_selesai')} />
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Batal</Button>
        <Button type="submit" loading={isSubmitting} className="flex-1 justify-center">SIMPAN PROYEK</Button>
      </div>
    </form>
  );
}
