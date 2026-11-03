import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type VolumePoint = { date: string; count: number };
type CategoryMap = Record<string, number>;
type TrendPoint = { keyword: string; article_count: number };

const COLORS = ["#198653", "#3974ac", "#bd7a20", "#7562aa", "#c45b54", "#2c9c9b"];

export const VolumeChart = ({ data }: { data: VolumePoint[] }) => (
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={data}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
      <Tooltip />
      <Line type="monotone" dataKey="count" name="Articles" stroke="#198653" strokeWidth={3} dot={false} />
    </LineChart>
  </ResponsiveContainer>
);

export const CategoryChart = ({ categories }: { categories: CategoryMap }) => {
  const data = Object.entries(categories)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name, value }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
          {data.map((category, index) => (
            <Cell key={category.name} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 10 }} />
      </PieChart>
    </ResponsiveContainer>
  );
};

export const TrendChart = ({ trends }: { trends: TrendPoint[] }) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={trends.slice(0, 10)} layout="vertical" margin={{ left: 30, right: 20 }}>
      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
      <YAxis type="category" dataKey="keyword" width={120} tick={{ fontSize: 10 }} />
      <Tooltip />
      <Bar dataKey="article_count" name="Articles" fill="#198653" radius={[0, 5, 5, 0]} />
    </BarChart>
  </ResponsiveContainer>
);
