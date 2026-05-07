import { useParams } from 'react-router-dom';
import JobForm from '../components/JobForm.jsx';

export default function AddJobPage() {
  const { id } = useParams();
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">{id ? 'Edit Application' : 'Add Application'}</h2>
        <p className="text-gray-500 text-sm mt-1">{id ? 'Update the details below' : 'Fill in the details of your job application'}</p>
      </div>
      <div className="card">
        <JobForm />
      </div>
    </div>
  );
}
