import { notFound } from "next/navigation";
import { ResourceForm } from "@/components/hub/resource-form";
import { getResource } from "@/lib/resources";

export const metadata = { title: "Edit document — WHRD Hub" };

export default async function EditResource({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getResource(id);
  if (!item) notFound();
  return <ResourceForm item={item} />;
}
